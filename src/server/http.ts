import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { ApiError, zodToApiError } from './errors';

/**
 * One centralized error handler for every API route.
 * Anything thrown inside a `route()` wrapper becomes a predictable JSON body:
 *   { error: string, code?: string }
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const apiError = zodToApiError(err);
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: apiError.status });
  }
  console.error('[api] Unhandled error:', err);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

/**
 * Wrap a route handler with the centralized error handler.
 * Usage: export const GET = route(async (req) => { ... });
 */
export function route<C = unknown>(
  handler: (req: NextRequest, ctx: C) => Promise<Response> | Response
): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return handleApiError(err);
    }
  };
}
