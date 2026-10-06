import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The one set of credentials that works regardless of what is in the database,
 * so wiping the tables (or seeding them) can never lock anyone out of the app.
 *
 * Each value is overridable from the environment; the defaults are what the
 * login page offers a first-time operator.
 */
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";
const DEFAULT_NAME = "Administrator";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

const env = (name: string, fallback: string) => {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
};

export interface AuthUser {
  username: string;
  name: string;
}

export interface SessionClaims extends AuthUser {
  /** Unix seconds. */
  expiresAt: number;
}

export function configuredCredentials(): AuthUser & { password: string } {
  return {
    username: env("DMS_AUTH_USERNAME", DEFAULT_USERNAME),
    password: env("DMS_AUTH_PASSWORD", DEFAULT_PASSWORD),
    name: env("DMS_AUTH_NAME", DEFAULT_NAME),
  };
}

const digest = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest();

/**
 * Constant-time comparison of two digests of equal length. Comparing the
 * password itself with `===` leaks how many leading characters were right, and
 * that is enough to walk a short default password one character at a time.
 */
const safeEqual = (a: Buffer, b: Buffer) =>
  a.length === b.length && timingSafeEqual(a, b);

export function verifyCredentials(username: string, password: string): AuthUser | null {
  const credentials = configuredCredentials();

  const usernameMatches = safeEqual(
    digest(credentials.username, "username"),
    digest(username.trim(), "username")
  );
  const passwordMatches = safeEqual(
    digest(credentials.password, "password"),
    digest(password, "password")
  );

  if (!usernameMatches || !passwordMatches) return null;
  return { username: credentials.username, name: credentials.name };
}

const signingKey = () => env("DMS_AUTH_SECRET", "dms-local-dev-secret");

/**
 * `payload.signature`, both base64url. No library: an HMAC over the exact
 * bytes the client echoes back is the whole verification, and pulling in a JWT
 * dependency for that would be more surface than the feature needs.
 */
export function signSessionToken(user: AuthUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.username,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    })
  ).toString("base64url");

  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionClaims | null {
  if (!token) return null;

  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = createHmac("sha256", signingKey()).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (!safeEqual(expected, provided)) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims !== "object" || claims === null) return null;

  const { sub, name, exp } = claims as { sub?: unknown; name?: unknown; exp?: unknown };
  if (typeof sub !== "string" || typeof exp !== "number") return null;
  if (exp * 1000 <= Date.now()) return null;

  return { username: sub, name: typeof name === "string" ? name : sub, expiresAt: exp };
}

/** `Bearer <token>` → `<token>`, or undefined when the header is absent. */
export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token, ...rest] = header.split(" ");
  if (rest.length > 0 || !token || scheme.toLowerCase() !== "bearer") return undefined;
  return token;
}
