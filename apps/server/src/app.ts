import cors from "cors";
import express, { type Express } from "express";
import { allowedOrigins } from "./config/env";
import { errorHandler, notFoundHandler } from "./http";
import { authContext, bootstrapAuthContext } from "./middleware/auth-context";
import { apiRouter } from "./routes";
import { organizationRouter } from "./routes/organization";
import { debugRouter } from "./routes/__debug";

export function createApp(): Express {
  const app: Express = express();

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
    })
  );
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
  // `notFoundHandler` terminates this mount rather than letting an unmatched
  // organization path fall through: it would reach `authContext` below, which
  // answers 400 ORGANIZATION_REQUIRED for a path that does not exist, and a
  // caller with a perfectly good organization header would be told to send one.
  app.use(
    "/api/organizations",
    bootstrapAuthContext,
    organizationRouter,
    notFoundHandler
  );

  app.use("/api", authContext, apiRouter);

  if (process.env.NODE_ENV !== "production") {
    app.use("/__debug", debugRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
