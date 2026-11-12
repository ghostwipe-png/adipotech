export interface Env {
  adipotech_sub_db: D1Database;
  PAYSTACK_SECRET_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'subscription-service' }), { headers });
      }

      if (url.pathname === '/webhook/paystack' && request.method === 'POST') {
        const signature = request.headers.get('x-paystack-signature');
        if (!signature) return new Response(JSON.stringify({ error: 'No signature provided' }), { status: 401, headers });

        const rawBody = await request.text();
        const isValid = await verifyPaystackSignature(rawBody, signature, env.PAYSTACK_SECRET_KEY);
        
        if (!isValid) return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers });

        const event = JSON.parse(rawBody);
        
        // Process specific Paystack events
        if (event.event === 'charge.success') {
          await processChargeSuccess(event.data, env.adipotech_sub_db);
        }

        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers });
      }

      // GET /status?user_id=...
      if (url.pathname === '/status' && request.method === 'GET') {
        const userId = url.searchParams.get('user_id');
        if (!userId) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers });

        const { results } = await env.adipotech_sub_db.prepare(
          `SELECT status, current_period_end, grace_period_end FROM subscriptions WHERE user_id = ?`
        ).bind(userId).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ status: 'free' }), { headers });
        }

        return new Response(JSON.stringify(results[0]), { headers });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: 'Internal Error', details: error.message }), { status: 500, headers });
    }
  },
};

async function verifyPaystackSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === signature;
}

async function processChargeSuccess(data: any, db: D1Database) {
  // Paystack sends customer email and metadata (where we put user_id)
  const email = data.customer.email;
  const userId = data.metadata?.user_id || 'unknown_user';
  
  // Calculate dates
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  const currentPeriodEnd = nextMonth.toISOString();
  const gracePeriodEnd = new Date(nextMonth.getTime() + (3 * 24 * 60 * 60 * 1000)).toISOString();

  // Upsert the subscription status to 'active'
  await db.prepare(`
    INSERT INTO subscriptions (user_id, email, status, current_period_end, grace_period_end)
    VALUES (?, ?, 'active', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET 
      status = 'active',
      current_period_end = excluded.current_period_end,
      grace_period_end = excluded.grace_period_end,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, email, currentPeriodEnd, gracePeriodEnd).run();
}