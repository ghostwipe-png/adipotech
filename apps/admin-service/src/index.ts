export interface Env {
  adipotech_policy_db: D1Database;
  INTERNAL_API_KEY: string;
  adipotech_media: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 
      'Content-Type': 'application/json', 
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': 'https://adipotech.pages.dev', // Allow frontend to call this
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
      
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // 1. Internal API Check (For Entitlement Service)
      if (url.pathname.startsWith('/internal/')) {
        const providedKey = request.headers.get('X-Internal-Key');
        if (!providedKey || providedKey !== env.INTERNAL_API_KEY) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        }
      }

      // 2. Health Check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'admin-service' }), { headers });
      }

      // 3. Create a new Post (Admin Only)
      if (url.pathname === '/api/posts' && request.method === 'POST') {
        const body = await request.json() as any;
        
        if (!body.id || !body.title || !body.description) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers });
        }

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

      // 4. List all Posts (Admin Only)
      if (url.pathname === '/api/posts' && request.method === 'GET') {
        const { results } = await env.adipotech_policy_db.prepare(
          `SELECT * FROM posts ORDER BY created_at DESC`
        ).all();

        return new Response(JSON.stringify({ posts: results }), { headers });
      }

      // 5. Set Enforcement Policy for a Post
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

      // 6. Upload Media (Admin Only)
      if (url.pathname === '/api/upload' && request.method === 'POST') {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
          return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400, headers });
        }

        const ext = file.name.split('.').pop();
        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        // Upload to R2 using the correct binding
        await env.adipotech_media.put(filename, file.stream(), {
          httpMetadata: { contentType: file.type }
        });

        // Placeholder URL (we will configure a public R2 domain later)
        const fileUrl = `https://media.adipotech.co.ke/${filename}`; 

        return new Response(JSON.stringify({ success: true, url: fileUrl, type: file.type }), { status: 201, headers });
      }

      // 7. Internal route for Entitlement Service to read policies
      if (url.pathname === '/internal/policy' && request.method === 'GET') {
        const postId = url.searchParams.get('post_id');
        if (!postId) {
          return new Response(JSON.stringify({ error: 'post_id required' }), { status: 400, headers });
        }

        const { results } = await env.adipotech_policy_db.prepare(
          `SELECT * FROM policies WHERE post_id = ?`
        ).bind(postId).all();

        const policy = results[0] || null;
        return new Response(JSON.stringify({ policy }), { headers });
      }

      // 8. Public route: Get safe post data for the frontend
      if (url.pathname.startsWith('/public/post/') && request.method === 'GET') {
        const postId = url.pathname.split('/').pop();
        
        if (!postId) {
          return new Response(JSON.stringify({ error: 'Post ID required' }), { status: 400, headers });
        }

        const { results } = await env.adipotech_policy_db.prepare(
          `SELECT id, title, description, media_url, media_type FROM posts WHERE id = ?`
        ).bind(postId).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404, headers });
        }

        return new Response(JSON.stringify({ post: results[0] }), { headers });
      }

      // Default: Deny access to unknown routes
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });

    } catch (error: any) {
      // Generic error handler to prevent leaking stack traces
      return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers });
    }
  },
};