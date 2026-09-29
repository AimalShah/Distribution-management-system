import { type ZodError, flattenError } from "zod";
import { HttpError, badRequest, conflict, notFound } from "./errors";

type PrismaLikeError = { code?: unknown; meta?: { target?: unknown } };

const isPrismaLikeError = (error: unknown): error is PrismaLikeError =>
  typeof error === "object" && error !== null && "code" in error;

/**
 * Prisma error codes are mapped centrally so the 15 Checkpoint 2 route groups
 * do not each grow their own try/catch. The check is structural rather than
 * `instanceof Prisma.PrismaClientKnownRequestError` on purpose: the generated
 * client is stubbed out in unit tests, and the `code` property is the part the
 * mapping actually depends on.
 */
export const translatePrismaError = (error: unknown): HttpError | null => {
  if (!isPrismaLikeError(error) || typeof error.code !== "string") return null;

  switch (error.code) {
    case "P2002":
      return conflict("A record with that value already exists", "UNIQUE_CONSTRAINT", {
        target: error.meta?.target,
      });
    case "P2003":
      return badRequest(
        "A referenced record does not exist or belongs to another organization",
        "FOREIGN_KEY_VIOLATION"
      );
    case "P2014":
      return badRequest("A required relation is missing", "RELATION_VIOLATION");
    case "P2025":
      return notFound("Record not found", "NOT_FOUND");
    case "P2034":
      // Two Serializable transactions wanted to write the same rows and the
      // database aborted one of them. Nothing it wrote was committed, so this is
      // a 409 the caller can retry, not a server fault.
      return conflict(
        "This change conflicted with another in-flight write. Please retry.",
        "WRITE_CONFLICT"
      );
    default:
      return null;
  }
};

export const translateZodError = (error: ZodError): HttpError =>
  badRequest("Request validation failed", "VALIDATION_ERROR", flattenError(error));
