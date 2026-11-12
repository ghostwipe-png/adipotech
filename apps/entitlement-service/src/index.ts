export interface Env {
  ADMIN_SERVICE: Fetcher;
  SUBSCRIPTION_SERVICE: Fetcher;
  INTERNAL_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'entitlement-service' }), { headers });
      }

      if (url.pathname === '/check' && request.method === 'POST') {
        const body = await request.json() as any;
        
        if (!body.post_id || !body.action) {
          return new Response(JSON.stringify({ error: 'post_id and action are required' }), { status: 400, headers });
        }

        // 1. Fetch the real policy from the Admin Service via Service Binding
        const policyReq = new Request(`http://admin-service/internal/policy?post_id=${body.post_id}`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'X-Internal-Key': env.INTERNAL_API_KEY // Authenticate with Admin Service
          }
        });

        const policyRes = await env.ADMIN_SERVICE.fetch(policyReq);
        const data = await policyRes.json() as any;
        const policy = data.policy;

        // 2. Fail closed: If no policy exists, deny access.
        if (!policy) {
          return new Response(JSON.stringify({ allowed: false, missing: ['no_policy_found'] }), { status: 200, headers });
        }

        const missingRequirements: string[] = [];
        const userId = body.user_id || 'test_user'; // Default to test_user for our simulation

        // 3. Check Subscription Status via Service Binding
        let userIsSubscribed = false;
        if (policy.require_subscribe === 1) {
          const subReq = new Request(`http://subscription-service/status?user_id=${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          try {
            const subRes = await env.SUBSCRIPTION_SERVICE.fetch(subReq);
            const subData = await subRes.json() as any;
            // The subscription is valid if status is explicitly 'active'
            userIsSubscribed = (subData.status === 'active');
          } catch (e) {
            console.error('Failed to reach Subscription Service:', e);
            // Fail closed on error - user is not subscribed if we can't verify
            userIsSubscribed = false;
          }
        }

        // 4. Evaluate other requirements (Simulated for now)
        const userHasLiked = false;
        const userHasCommented = false;
        const userDonationAmount = 0;

        if (policy.require_subscribe === 1 && !userIsSubscribed) missingRequirements.push('subscribe');
        if (policy.require_like === 1 && !userHasLiked) missingRequirements.push('like');
        if (policy.require_comment === 1 && !userHasCommented) missingRequirements.push('comment');
        if (policy.require_donate_amount > 0 && userDonationAmount < policy.require_donate_amount) {
          missingRequirements.push('donate');
        }

        // 5. Final Decision
        if (missingRequirements.length > 0) {
          return new Response(JSON.stringify({ allowed: false, missing: missingRequirements }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ allowed: true, missing: [] }), { headers });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: 'Internal Error', details: error.message }), { status: 500, headers });
    }
  },
};