import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Express 4 does not await route handlers, so a rejected promise becomes an
 * unhandled rejection instead of a 500. Every async handler is wrapped in this.
 */
export const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
