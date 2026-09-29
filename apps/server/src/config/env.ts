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
 * The auth middleware in `middleware/auth-context.ts` reads the tenant from a
 * client supplied header, so a caller can pick any organization. That is only
 * acceptable while the server is unreachable from anything the caller does not
 * control, so a production process refuses to start rather than discovering the
 * problem after another tenant's invoices have been read.
 *
 * `DMS_TRUSTED_PROXY_AUTH=true` is the escape hatch for deployments that
 * terminate authentication at a gateway and forward the headers themselves.
 * Checkpoint 3 replaces the shim and this check together.
 */
export function assertAuthShimIsSafe(): void {
  if (!isProduction) return;
  if (process.env.DMS_TRUSTED_PROXY_AUTH === "true") return;

  throw new Error(
    "Refusing to start: middleware/auth-context.ts trusts a client supplied " +
      "x-organization-id header, so any caller can choose their own tenant. " +
      "This is the temporary stand-in for the session middleware in Checkpoint " +
      "3 and must not run in production. Set DMS_TRUSTED_PROXY_AUTH=true only " +
      "if a trusted gateway authenticates the request and forwards these " +
      "headers itself."
  );
}
