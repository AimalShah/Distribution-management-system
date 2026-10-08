export { asyncHandler } from "./async-handler";

export { errorHandler, notFoundHandler } from "./error-handler";

/**
 * The read convention, stated where every module that throws or handles one of
 * these already looks:
 *
 * - A required read -- `getXById`, `getXByCode`, anything a route cannot answer
 *   without -- throws `notFound` from its service module and never returns
 *   null. The read module owns the error mode, so the route calls it and sends
 *   the row; it does not re-check for null and reword the same 404.
 * - A lookup where "no row" is a real answer -- flow control inside a write, or
 *   a state the route renders itself, like no active organization -- is named
 *   for that (`findX`, `verifyX`), returns null, and is never a 404 by
 *   construction. Optional by name, not by call-site inspection.
 */
export {
  HttpError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
  unprocessable,
} from "./errors";

export { translatePrismaError, translateZodError } from "./prisma-errors";