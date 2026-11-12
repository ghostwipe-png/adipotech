export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  // Forward to the admin service, preserving the path after /api/admin/
  const adminPath = url.pathname.replace('/api/admin/', '');
  const adminUrl = `https://admin-service.opinionplus.workers.dev/${adminPath}`;

  // Create a new request to the admin service
  const adminRequest = new Request(adminUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: 'manual',
  });

  // Forward the request
  const response = await fetch(adminRequest);

  // Return the response with the original CORS headers (or none, since it's same-origin now)
  const newResponse = new Response(response.body, response);
  // Remove the wildcard origin that Access adds
  newResponse.headers.delete('Access-Control-Allow-Origin');
  newResponse.headers.delete('Access-Control-Allow-Credentials');
  
  return newResponse;
};