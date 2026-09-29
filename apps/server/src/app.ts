import cors from "cors";
import express, { type Express } from "express";
import { errorHandler, notFoundHandler } from "./http";
import { authContext } from "./middleware/auth-context";
import { apiRouter } from "./routes";
import { debugRouter } from "./routes/__debug";

export function createApp(): Express {
  const app: Express = express();

  app.use(cors());
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
