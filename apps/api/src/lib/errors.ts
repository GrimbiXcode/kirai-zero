/**
 * Errors thrown by route handlers. `code` is a stable machine-readable string
 * the client maps to a translated message; `message` is only a developer hint
 * and is never shown to users.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (code = "unauthorized", message = "Not signed in") =>
  new AppError(401, code, message);

export const forbidden = (code = "forbidden", message = "Not allowed") =>
  new AppError(403, code, message);

/**
 * Also used where 403 would be the semantically closer answer: telling an
 * outsider "this account exists but you may not see it" leaks the existence of
 * accounts, so unrelated users get a plain 404 instead.
 */
export const notFound = (code = "not_found", message = "Not found") =>
  new AppError(404, code, message);

export const conflict = (code: string, message: string) =>
  new AppError(409, code, message);
