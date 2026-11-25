// Pages ingress for networks unable to resolve/reach workers.dev over IPv4.
// The original request URL is preserved so cookies and CSRF stay same-origin.
export default {
  fetch(request, env) {
    return env.FACULTY.fetch(request);
  }
};
