// Pages ingress for networks unable to resolve/reach workers.dev over IPv4.
// The original request URL is preserved so cookies and CSRF stay same-origin.
const STATIC_DATA = "__STATIC_DATA__";
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/') || path === '/preview' || path === '/health' ||
      (!STATIC_DATA && (path.startsWith('/data/') || path === '/faculty' || path === '/rpage-preview'))) {
      const result = await env.FACULTY.fetch(request);
      const response = new Response(result.body, result);
      response.headers.set('X-Faculty-Delivery', 'worker');
      return response;
    }
    return env.ASSETS.fetch(request);
  }
};
