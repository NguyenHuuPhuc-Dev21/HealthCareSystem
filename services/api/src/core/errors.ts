/**
 * Standard application errors. Services throw these; the error handler turns
 * them into the agreed JSON envelope: { success: false, error: { code, message } }.
 * Error codes are UPPER_SNAKE and documented in docs/api/<module>.api.md.
 */

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (code: string, message: string) => new AppError(403, code, message);
export const notFound = (code: string, message: string) => new AppError(404, code, message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);

/**
 * Human-readable text for any thrown value, for startup/CLI logs.
 * Needed because a refused DB connection on Windows/Node ≥ 20 is an
 * AggregateError (IPv4 + IPv6 attempts) whose `message` is empty.
 */
export function describeError(err: unknown): string {
  if (err instanceof AggregateError && err.errors.length > 0) {
    return err.errors.map((e) => describeError(e)).join(' | ');
  }
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    const text = err.message || err.name;
    return code && !text.includes(code) ? `${code}: ${text}` : text;
  }
  return String(err);
}
