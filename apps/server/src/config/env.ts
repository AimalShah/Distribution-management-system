const isProduction = process.env.NODE_ENV === "production";

/**
 * Where `apps/web` runs in development, and what the root `.env` already names
 * in `BETTER_AUTH_URL` / `TRUSTED_ORIGINS`. Used only when `DMS_ALLOWED_ORIGINS`
 * is unset, so a developer never has to configure CORS to get started.
 */
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const parseOrigins = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

/**
 * `cors()` with no arguments answers `Access-Control-Allow-Origin: *` to any
 * page on the internet, which is how a hostile site in a user's tab reaches this
 * API and reads the response. The browser is the only thing CORS applies to, so
 * a request with no `Origin` — curl, another server, the test suite — is
 * unaffected and is not required to appear here.
 */
export const allowedOrigins = new Set(
  parseOrigins(process.env.DMS_ALLOWED_ORIGINS).length > 0
    ? parseOrigins(process.env.DMS_ALLOWED_ORIGINS)
    : DEV_ORIGINS
);

export const port = Number(process.env.PORT ?? 4000);

/**
 * Loopback by default. `app.listen(port)` with no host binds every interface,
 * which puts a server that trusts an `x-organization-id` request header on the
 * network. `DMS_HOST=0.0.0.0` is the deliberate way to opt out.
 */
export const host = process.env.DMS_HOST ?? "127.0.0.1";

/**
 * Production refuses to start with an auth configuration that would let a
 * caller forge a session.
 *
 * Session mode (the default) needs `BETTER_AUTH_SECRET`: it signs the session
 * cookie, and without it better-auth falls back to a built-in default that
 * anyone can read, so anyone could sign a cookie for a session token they
 * observed.
 *
 * Trusted-proxy mode (`DMS_TRUSTED_PROXY_AUTH=true`) passes, because setting it
 * is the operator stating that a gateway authenticates every request and sets
 * the tenant headers itself -- see `AuthMode` in `middleware/auth-context.ts`.
 */
export function assertAuthIsSafe(): void {
  if (!isProduction) return;

  if (process.env.DMS_TRUSTED_PROXY_AUTH === "true") return;

  if ((process.env.BETTER_AUTH_SECRET ?? "").length < 32) {
    throw new Error(
      "Refusing to start: BETTER_AUTH_SECRET must be set to at least 32 " +
        "characters in production. It signs session cookies; without it " +
        "better-auth uses a default secret that anyone can read."
    );
  }
}
