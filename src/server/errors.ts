/**
 * Domain error with a stable code (for API clients) and a translation key (for UI).
 * Services throw these; route handlers and server actions map them to responses.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "UNSERVICEABLE"
  | "SLOT_FULL"
  | "QUOTE_NOT_ACTIONABLE";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  UNSERVICEABLE: 422,
  SLOT_FULL: 409,
  QUOTE_NOT_ACTIONABLE: 409,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly messageKey: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, messageKey: string, details?: unknown) {
    super(`${code}: ${messageKey}`);
    this.code = code;
    this.status = STATUS[code];
    this.messageKey = messageKey;
    this.details = details;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** Customer-facing records that the actor may not see are reported as NOT_FOUND, never FORBIDDEN (avoids leaking existence). */
export const notFound = (what = "record") => new AppError("NOT_FOUND", `errors.notFound.${what}`);
