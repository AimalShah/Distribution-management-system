import { ZodError } from "zod";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "./errors";
import { translatePrismaError, translateZodError } from "./prisma-errors";
import { logger } from "../logger";

type FrameworkError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

const translate = (error: unknown): HttpError | null => {
  if (error instanceof HttpError) return error;

  if (error instanceof ZodError) return translateZodError(error);

  return translatePrismaError(error);
};

/** Statuses raised by express.json() and friends, which carry no error code. */
const frameworkStatus = (error: FrameworkError): number | undefined => {
  if (error.type === "entity.parse.failed") return 400;

  if (typeof error.status === "number") return error.status;

  if (typeof error.statusCode === "number") return error.statusCode;

  return undefined;
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Cannot ${req.method} ${req.path}`, "ROUTE_NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const translated = translate(error);

  const logServerError = (status: number, code: string) => {
    const fields = {
      event: "request_error",
      method: req.method,
      path: req.path,
      status,
      errorType: error instanceof Error ? error.name : typeof error,
      errorCode: code,
    };

    if (req.log) req.log.error(fields, "request failed");
    else logger.error({ ...fields, requestId: req.id ?? "unknown" }, "request failed");
  };

  if (translated) {
    if (translated.status >= 500) logServerError(translated.status, translated.code);

    res.status(translated.status).json({
      error: translated.message,
      code: translated.code,
      ...(translated.details === undefined ? {} : { details: translated.details }),
    });

    return;
  }

  const status = frameworkStatus(error as FrameworkError) ?? 500;

  if (status >= 500) {
    logServerError(status, "INTERNAL_ERROR");
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });

    return;
  }

  res.status(status).json({ error: error.message, code: "BAD_REQUEST" });
};
