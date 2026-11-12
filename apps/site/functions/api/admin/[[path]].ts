/// <reference types="@cloudflare/workers-types" />

export const onRequestPost: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const adminPath = url.pathname.replace('/api/admin/', '');
  const adminUrl = `https://admin-service.opinionplus.workers.dev/${adminPath}`;

  // We need to clone the headers and remove 'host' 
  // because Cloudflare Workers will reject the fetch if the host doesn't match
  const newHeaders = new Headers(context.request.headers);
  newHeaders.delete('host');
  newHeaders.delete('origin'); // Remove origin to prevent CORS rejection at the Worker level

  const adminRequest = new Request(adminUrl, {
    method: 'POST',
    headers: newHeaders,
    body: context.request.body,
    redirect: 'manual',
  });

  const response = await fetch(adminRequest);
  
  // Return the response, but add CORS headers so the browser accepts it
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', 'https://adipotech.pages.dev');
  newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return newResponse;
};

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const adminPath = url.pathname.replace('/api/admin/', '');
  const adminUrl = `https://admin-service.opinionplus.workers.dev/${adminPath}`;

  const newHeaders = new Headers(context.request.headers);
  newHeaders.delete('host');
  newHeaders.delete('origin');

  const adminRequest = new Request(adminUrl, {
    method: 'GET',
    headers: newHeaders,
  });

  const response = await fetch(adminRequest);
  
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', 'https://adipotech.pages.dev');
  newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return newResponse;
};