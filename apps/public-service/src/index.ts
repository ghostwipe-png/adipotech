export interface Env {
  ADMIN_SERVICE: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // SECURITY & CORS: Allow only your frontend to talk to this API
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': 'https://adipotech.pages.dev', // Lock to your domain
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // Route: /api/post/:id
      if (url.pathname.startsWith('/api/post/') && request.method === 'GET') {
        const postId = url.pathname.split('/').pop();
        
        // Fetch from the locked Admin Service via internal Service Binding
        const adminReq = new Request(`http://admin-service/public/post/${postId}`, {
          method: 'GET'
        });
        
        const adminRes = await env.ADMIN_SERVICE.fetch(adminReq);
        const data = await adminRes.text(); // Use text to preserve the exact JSON
        
        return new Response(data, { status: adminRes.status, headers });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: 'Internal Error', details: error.message }), { status: 500, headers });
    }
  },
};