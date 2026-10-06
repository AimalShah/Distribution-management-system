export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST", details?: unknown) =>
  new HttpError(400, message, code, details);

export const notFound = (message: string, code = "NOT_FOUND") =>
  new HttpError(404, message, code);

export const conflict = (message: string, code = "CONFLICT", details?: unknown) =>
  new HttpError(409, message, code, details);

/**
 * No usable credentials were presented. 401 rather than 403 because the fix is
 * to authenticate again, not to ask someone else for permission.
 */
export const unauthorized = (message: string, code = "UNAUTHORIZED", details?: unknown) =>
  new HttpError(401, message, code, details);

/**
 * The caller is known -- they hold a valid user and session -- but this action
 * is not theirs to take. Distinguished from 404 because "you are not a member of
 * this organization" is the useful answer, and from 422 because nothing about
 * the request was malformed.
 */
export const forbidden = (message: string, code = "FORBIDDEN", details?: unknown) =>
  new HttpError(403, message, code, details);

/**
 * A well-formed request that asks for something this tenant cannot use, such as
 * a body pointing at a row in another organization. Distinct from 400, which
 * says the request itself was malformed, and from 404, which would confirm
 * whether the row exists elsewhere.
 */
export const unprocessable = (
  message: string,
  code = "UNPROCESSABLE_ENTITY",
  details?: unknown
) => new HttpError(422, message, code, details);
