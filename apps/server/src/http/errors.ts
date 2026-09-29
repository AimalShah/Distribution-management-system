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
