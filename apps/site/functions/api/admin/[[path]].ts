            export const onRequestPost: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const adminPath = url.pathname.replace('/api/admin/', '');
  const adminUrl = `https://admin-service.opinionplus.workers.dev/${adminPath}`;

  const adminRequest = new Request(adminUrl, {
    method: 'POST',
    headers: context.request.headers,
    body: context.request.body,
    redirect: 'manual',
  });

  const response = await fetch(adminRequest);
  return new Response(response.body, response);
};

// Optional: Handle GET requests if you later add fetching
export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const adminPath = url.pathname.replace('/api/admin/', '');
  const adminUrl = `https://admin-service.opinionplus.workers.dev/${adminPath}`;

  const adminRequest = new Request(adminUrl, {
    method: 'GET',
    headers: context.request.headers,
  });

  const response = await fetch(adminRequest);
  return new Response(response.body, response);
};