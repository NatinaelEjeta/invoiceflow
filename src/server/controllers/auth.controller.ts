import { NextResponse, type NextRequest } from 'next/server';
import { ApiError } from '@/server/errors';
import { SESSION_COOKIE, getSessionUser, sessionCookieOptions, signSessionToken } from '@/server/middleware/auth';
import { authenticate, changePassword as changePasswordService, registerWorkspace } from '@/server/services/auth.service';
import { changePasswordSchema, loginSchema, registerSchema } from '@/server/validation';

function publicUser(user: { id: string; name: string; email: string; role: string; accountId: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, accountId: user.accountId };
}

function publicAccount(account: {
  id: string;
  name: string;
  plan: string;
  logoText: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  footerNote: string;
}) {
  return {
    id: account.id,
    name: account.name,
    plan: account.plan,
    logoText: account.logoText,
    defaultCurrency: account.defaultCurrency,
    defaultTaxRate: account.defaultTaxRate,
    footerNote: account.footerNote,
  };
}

export async function register(req: NextRequest) {
  const input = registerSchema.parse(await req.json());
  const user = await registerWorkspace(input);
  const token = await signSessionToken(user.id);
  const res = NextResponse.json(
    { user: publicUser(user), account: publicAccount(user.account) },
    { status: 201 }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

export async function login(req: NextRequest) {
  const input = loginSchema.parse(await req.json());
  const user = await authenticate(input);
  const token = await signSessionToken(user.id);
  const res = NextResponse.json(
    { user: publicUser(user), account: publicAccount(user.account) },
    { status: 200 }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

export async function logout() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return res;
}

export async function me(req: NextRequest) {
  const user = await getSessionUser(req);
  return NextResponse.json({ user: publicUser(user), account: publicAccount(user.account) });
}

export async function changePassword(req: NextRequest) {
  const user = await getSessionUser(req);
  const input = changePasswordSchema.parse(await req.json());
  await changePasswordService(user, input);
  return NextResponse.json({ ok: true });
}

export function requireAuthOrThrow() {
  throw ApiError.unauthorized();
}
