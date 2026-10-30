import { ZodError } from 'zod';

/**
 * Centralized API error. Services throw ApiError and the route layer
 * (src/server/http.ts) converts it into a consistent JSON response.
 * Status codes used across the app: 400, 401, 402, 403, 404, 409.
 */
export class ApiError extends Error {
  public status: number;
  public code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string, code?: string) {
    return new ApiError(400, message, code);
  }
  static unauthorized(message = 'You must be signed in to do that.') {
    return new ApiError(401, message, 'UNAUTHENTICATED');
  }
  static paymentRequired(message: string) {
    return new ApiError(402, message, 'PLAN_LIMIT');
  }
  static forbidden(message: string) {
    return new ApiError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, message, 'NOT_FOUND');
  }
  static conflict(message: string) {
    return new ApiError(409, message, 'CONFLICT');
  }
}

/** Convert a ZodError into a friendly 400 ApiError (first issue wins). */
export function zodToApiError(err: ZodError): ApiError {
  const first = err.issues[0];
  const field = first && first.path.length > 0 ? first.path.join('.') : undefined;
  const message = first ? `${field ? `${field}: ` : ''}${first.message}` : 'Invalid request.';
  return ApiError.badRequest(message, 'VALIDATION_ERROR');
}
