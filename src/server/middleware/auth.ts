import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ApiError } from '@/server/errors';

export const SESSION_COOKIE = 'invoiceflow_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** A user with its workspace (account) loaded — the shape used by all services. */
export type SessionUser = Prisma.UserGetPayload<{ include: { account: true } }>;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new ApiError(500, 'Server misconfiguration: JWT_SECRET must be set to at least 16 characters.');
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

/** Returns the userId (JWT "sub") or null when the token is invalid/expired. */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Load the user from the database for every single request — a deleted or
 * demoted user loses access immediately, even with a valid JWT.
 */
async function loadUser(userId: string): Promise<SessionUser | null> {
  return db.user.findUnique({ where: { id: userId }, include: { account: true } });
}

/**
 * API-route guard. Verifies the JWT cookie, RELOADS the user from the
 * database, and returns it. Throws 401 when not authenticated.
 * Every protected route calls this — the server never trusts the client.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw ApiError.unauthorized();
  const userId = await verifySessionToken(token);
  if (!userId) throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  const user = await loadUser(userId);
  if (!user) throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.');
  return user;
}

/** Server-component guard (layouts/pages) — same checks, reads next/headers. */
export async function getServerSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  return loadUser(userId);
}

/** Server-side role check. MEMBER cannot touch billing or team management. */
export function requireRole(user: { role: string }, roles: string[], action: string): void {
  if (!roles.includes(user.role)) {
    throw ApiError.forbidden(`Only the workspace ${roles.join(' or ').toLowerCase()} can ${action}.`);
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}
