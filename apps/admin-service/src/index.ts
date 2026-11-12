export interface Env {
  adipotech_policy_db: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Security Headers applied to all responses
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    };

    try {
      // 1. Health Check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'admin-service' }), { headers });
      }

      // 2. Create a new Post (Admin Only)
      if (url.pathname === '/api/posts' && request.method === 'POST') {
        const body = await request.json() as any;
        
        if (!body.id || !body.title || !body.description) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers });
        }

        // Insert into posts table
        await env.adipotech_policy_db.prepare(
          `INSERT INTO posts (id, title, description, media_url, media_type) VALUES (?, ?, ?, ?, ?)`
        ).bind(
          body.id, 
          body.title, 
          body.description, 
          body.media_url || null, 
          body.media_type || null
        ).run();

        return new Response(JSON.stringify({ success: true, message: 'Post created' }), { status: 201, headers });
      }

      // 3. List all Posts (Admin Only)
      if (url.pathname === '/api/posts' && request.method === 'GET') {
        const { results } = await env.adipotech_policy_db.prepare(
          `SELECT * FROM posts ORDER BY created_at DESC`
        ).all();

        return new Response(JSON.stringify({ posts: results }), { headers });
      }

      // 4. Set Enforcement Policy for a Post
      if (url.pathname === '/api/policies' && request.method === 'POST') {
        const body = await request.json() as any;

        if (!body.post_id) {
          return new Response(JSON.stringify({ error: 'post_id is required' }), { status: 400, headers });
        }

        await env.adipotech_policy_db.prepare(
          `INSERT INTO policies (post_id, require_like, require_comment, require_subscribe, require_donate_amount) 
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(post_id) DO UPDATE SET 
           require_like=excluded.require_like, 
           require_comment=excluded.require_comment, 
           require_subscribe=excluded.require_subscribe, 
           require_donate_amount=excluded.require_donate_amount`
        ).bind(
          body.post_id,
          body.require_like ? 1 : 0,
          body.require_comment ? 1 : 0,
          body.require_subscribe ? 1 : 0,
          body.require_donate_amount || 0
        ).run();

        return new Response(JSON.stringify({ success: true, message: 'Policy set' }), { status: 201, headers });
      }

      // Default: Deny access to unknown routes
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });

    } catch (error: any) {
      // Generic error handler to prevent leaking stack traces
      return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers });
    }
  },
};