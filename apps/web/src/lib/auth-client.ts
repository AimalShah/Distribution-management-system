import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

/**
 * Where the bearer token lives. Shared with the axios interceptor in `./api.ts`,
 * which sends it on every API call.
 */
export const AUTH_TOKEN_KEY = "auth_token";

const readToken = () => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};

/**
 * Same-origin by default: in development Vite proxies `/api` to the server, so
 * the session cookie is first-party and needs no CORS credentials. The Electron
 * shell loads the built bundle from disk, where there is no origin to share and
 * no cookie jar worth relying on, so it sets `VITE_SERVER_URL` and runs on the
 * bearer token the server returns in `set-auth-token` instead.
 */
export const authClient = createAuthClient({
  baseURL:
    import.meta.env.VITE_SERVER_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"),
  basePath: "/api/auth",
  plugins: [organizationClient(), adminClient()],
  fetchOptions: {
    auth: { type: "Bearer", token: readToken },
    onSuccess(ctx) {
      const token = ctx.response.headers.get("set-auth-token");
      if (token && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, token);
        } catch {}
      }
    },
  },
});

export async function signOut() {
  try {
    await authClient.signOut();
  } finally {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      } catch {}
    }
  }
}
