import cors from "cors";
import express, { type Express } from "express";
import { allowedOrigins } from "./config/env";
import { errorHandler, notFoundHandler } from "./http";
import { authContext } from "./middleware/auth-context";
import { apiRouter } from "./routes";
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

  app.use("/api", authContext, apiRouter);

  if (process.env.NODE_ENV !== "production") {
    app.use("/__debug", debugRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
