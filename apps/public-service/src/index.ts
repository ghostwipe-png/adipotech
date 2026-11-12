export interface Env {
  ADMIN_SERVICE: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': 'https://adipotech.pages.dev',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // Match /api/post/:id (ignoring trailing slashes)
      const match = url.pathname.match(/^\/api\/post\/([a-zA-Z0-9_-]+)\/?$/);
      
      if (match && request.method === 'GET') {
        const postId = match[1];
        
        // Fetch from the locked Admin Service via internal Service Binding
        const adminReq = new Request(`http://admin-service/public/post/${postId}`, {
          method: 'GET'
        });
        
        const adminRes = await env.ADMIN_SERVICE.fetch(adminReq);
        const data = await adminRes.text();
        
        return new Response(data, { status: adminRes.status, headers });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: 'Internal Error', details: error.message }), { status: 500, headers });
    }
  },
};