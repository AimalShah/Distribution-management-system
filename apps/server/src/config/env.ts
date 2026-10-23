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

const PRODUCTION_DEFAULT_ORIGINS = [
  "https://distribution-management-system.aimalshah62.workers.dev",
];

const parseOrigins = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const configuredOrigins = [
  ...parseOrigins(process.env.DMS_ALLOWED_ORIGINS),
  ...parseOrigins(process.env.TRUSTED_ORIGINS),
];

/**
 * `cors()` with no arguments answers `Access-Control-Allow-Origin: *` to any
 * page on the internet, which is how a hostile site in a user's tab reaches this
 * API and reads the response. The browser is the only thing CORS applies to, so
 * a request with no `Origin` — curl, another server, the test suite — is
 * unaffected and is not required to appear here.
 */
export const allowedOrigins = new Set([
  ...configuredOrigins,
  ...PRODUCTION_DEFAULT_ORIGINS,
  ...(configuredOrigins.length === 0 ? DEV_ORIGINS : []),
]);

export const port = Number(process.env.PORT ?? 4000);

/**
 * Whether, and for how many hops, to read `X-Forwarded-For` when attributing a
 * request to a client (`DMS_TRUST_PROXY`).
 *
 * Behind a TLS-terminating proxy (Render, a load balancer) every request
 * presents the proxy's address, and without trusting the forwarded header the
 * unit of "per visitor" for rate limits and for the session's recorded
 * `ipAddress` collapses to one shared address. Only setting it is safe: an
 * operator who says so is stating the number of proxy layers between the
 * internet and this process, and Express will then accept client addresses
 * from exactly that many forwarded headers -- a direct connection (the dev
 * default) keeps the header untrusted, where a caller could spoof anything.
 * `"true"` = one hop; an integer = that many; unset or `"false"` = direct.
 */
export const trustProxy: boolean | number = (() => {
  const raw = process.env.DMS_TRUST_PROXY?.trim();

  if (!raw || raw.toLowerCase() === "false") return false;
  if (raw.toLowerCase() === "true") return 1;

  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : false;
})();

/**
 * Loopback by default in dev/test, and 0.0.0.0 in production so cloud containers
 * (Render, Koyeb, Docker) bind external traffic properly.
 */
export const host = process.env.DMS_HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1");

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
