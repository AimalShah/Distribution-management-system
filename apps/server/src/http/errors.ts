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
