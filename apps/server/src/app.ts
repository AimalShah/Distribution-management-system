import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { createAuth, type Auth } from "./auth";
import { allowedOrigins, trustProxy } from "./config/env";
import { errorHandler, notFoundHandler } from "./http";
import {
  authContext,
  bootstrapAuthContext,
  resolveAuthMode,
  type AuthMode,
} from "./middleware/auth-context";
import {
  sessionAuthContext,
  sessionBootstrapAuthContext,
} from "./middleware/session";
import { authSurfaceLimiter, credentialEntryLimiter } from "./middleware/rate-limit";
import { apiRouter } from "./routes";
import { organizationRouter } from "./routes/organization";
import {
  memberRouter,
  organizationMemberRouter,
} from "./routes/member";
import { debugRouter } from "./routes/__debug";

export interface AppOptions {
  /** Defaults to `resolveAuthMode()`: `session` unless `DMS_TRUSTED_PROXY_AUTH=true`. */
  authMode?: AuthMode;
  /** Defaults to `createAuth()`. */
  auth?: Auth;
}

export function createApp(options: AppOptions = {}): Express {
  const app: Express = express();
  const authMode = options.authMode ?? resolveAuthMode();
  const auth = options.auth ?? createAuth();

  // Rate limits and session audit rows key on the client address; behind a
  // proxy that address is the proxy's unless the forwarded header is trusted.
  if (trustProxy !== false) {
    app.set("trust proxy", trustProxy);
  }

  const strict = authMode === "session" ? sessionAuthContext(auth) : authContext;

  const bootstrap =
    authMode === "session" ? sessionBootstrapAuthContext(auth) : bootstrapAuthContext;

  // CSP defaults block inline scripts but allow inline styles, which the
  // server-rendered document templates (invoice/statement HTML) rely on and
  // only inline-style use; no template ships a <script> tag.
  app.use(helmet());

  // An allowlist, not a wildcard: an origin that is not on it gets no CORS
  // headers, so the browser withholds the response from the calling page.
  // Requests without an `Origin` header are passed straight through, because
  // CORS only governs browsers.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);

          return;
        }

        const normalized = origin.replace(/\/+$/, "");

        if (allowedOrigins.has(origin) || allowedOrigins.has(normalized)) {
          callback(null, true);

          return;
        }

        callback(null, false);
      },
      // The session cookie only reaches a cross-origin API if the response
      // allows credentials. Safe alongside the allowlist above: credentials are
      // never granted to an origin that is not on it.
      credentials: true,
      // Expose set-auth-token so the frontend authClient can store the session
      // bearer token for cross-origin requests.
      exposedHeaders: ["set-auth-token"],
    })
  );

  // better-auth reads the raw body itself, so it is mounted ahead of
  // global `express.json()` -- a parsed body would leave its handler waiting on a
  // stream that has already been consumed.
  // better-auth is the only sign-in surface: the former credentials-fallback
  // router (an HMAC token that impersonated the first owner of the first
  // organization) was removed, so no unauthenticated caller gets a session
  // anything could vouch for.
  //
  // The limiters sit ahead of better-auth so a burst of credential guesses is
  // refused before reaching the auth service at all.
  app.use("/api/auth", authSurfaceLimiter);
  app.use(
    ["/api/auth/sign-in/email", "/api/auth/sign-up/email"],
    credentialEntryLimiter
  );
  app.all("/api/auth/*", toNodeHandler(auth));

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Mounted ahead of the strict `authContext` below, and not through `apiRouter`,
  // because POST /organizations is how a user creates their first organization
  // and therefore cannot require an active organization to get there. The other
  // fifteen routers all read a tenant from `req.auth.organizationId` and have no
  // reason to be reachable without one, so they stay on the strict middleware.
  //
  // `organizationMemberRouter` is in this stack and not in `apiRouter` because
  // its paths start `/organizations/:id/...`: mounted here, ahead of
  // `organizationRouter`, they reach their handler. Mounted anywhere later they
  // would be swallowed by the `notFoundHandler` that terminates this stack.
  //
  // `notFoundHandler` terminates this mount rather than letting an unmatched
  // organization path fall through: it would reach `authContext` below, which
  // answers 400 ORGANIZATION_REQUIRED for a path that does not exist, and a
  // caller with a perfectly good organization header would be told to send one.
  app.use(
    "/api/organizations",
    bootstrap,
    organizationMemberRouter,
    organizationRouter,
    notFoundHandler
  );

  // Same reasoning as the stack above, and it has to be mounted before the
  // `/api` line below for the same reason -- `authContext` there would answer
  // 400 ORGANIZATION_REQUIRED for a by-id member route that needs no tenant
  // header of its own.
  app.use("/api/members", bootstrap, memberRouter, notFoundHandler);

  // Authenticated tenant data is per-session, per-organization and money: no
  // intermediary is licensed to hand a cached copy to the next viewer. The
  // header applies to everything below it, so it sits on the authenticated
  // mounts only — `/api/health` and the auth surface stay out of scope.
  const noStore: RequestHandler = (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  };

  app.use("/api/organizations", noStore);
  app.use("/api/members", noStore);
  app.use("/api", strict, noStore, apiRouter);

  if (process.env.NODE_ENV !== "production") {
    app.use("/__debug", debugRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
