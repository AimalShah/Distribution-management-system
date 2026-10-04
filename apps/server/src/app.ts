import cors from "cors";
import express, { type Express } from "express";
import { toNodeHandler } from "better-auth/node";
import { createAuth, type Auth } from "./auth";
import { allowedOrigins } from "./config/env";
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

  const strict = authMode === "session" ? sessionAuthContext(auth) : authContext;
  const bootstrap =
    authMode === "session" ? sessionBootstrapAuthContext(auth) : bootstrapAuthContext;

  // An allowlist, not a wildcard: an origin that is not on it gets no CORS
  // headers, so the browser withholds the response from the calling page.
  // Requests without an `Origin` header are passed straight through, because
  // CORS only governs browsers.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      // The session cookie only reaches a cross-origin API if the response
      // allows credentials. Safe alongside the allowlist above: credentials are
      // never granted to an origin that is not on it.
      credentials: true,
    })
  );

  // better-auth reads the raw body itself, so it is mounted ahead of
  // `express.json()` -- a parsed body would leave its handler waiting on a
  // stream that has already been consumed.
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

  app.use("/api", strict, apiRouter);

  if (process.env.NODE_ENV !== "production") {
    app.use("/__debug", debugRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
