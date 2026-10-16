/**
 * Cloudflare Worker entrypoint with Static Assets.
 *
 * Proxies `/api/*` to the Render backend, allowing the SPA to talk to the
 * API same-origin with first-party cookies and avoiding 405 Method Not Allowed
 * on POST/PUT requests.
 * All other routes fall through to the static assets handler (env.ASSETS).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const backendBase =
        env.BACKEND_URL || "https://distribution-management-system-1-92tj.onrender.com";

      const targetUrl = new URL(url.pathname + url.search, backendBase);

      const headers = new Headers(request.headers);
      headers.set("host", targetUrl.host);
      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

      const isBodyAllowed = request.method !== "GET" && request.method !== "HEAD";

      return fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: isBodyAllowed ? request.body : undefined,
        redirect: "manual",
      });
    }

    return env.ASSETS.fetch(request);
  },
};
