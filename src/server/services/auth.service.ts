import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ApiError } from '@/server/errors';
import type { SessionUser } from '@/server/middleware/auth';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '@/server/validation';

/** Demo accounts cannot change their password (they are shared publicly). */
export const DEMO_EMAIL_SUFFIX = '@invoiceflow.demo';

const BCRYPT_ROUNDS = 10;

/**
 * Registration creates the workspace (Account) and its OWNER in one
 * transaction, so a workspace always has exactly one OWNER.
 */
export async function registerWorkspace(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists. Try signing in.');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return db.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        name: input.workspaceName.trim(),
        logoText: input.workspaceName.trim().slice(0, 2).toUpperCase(),
      },
    });
    return tx.user.create({
      data: { name: input.name.trim(), email, passwordHash, role: 'OWNER', accountId: account.id },
      include: { account: true },
    });
  });
}

export async function authenticate(input: LoginInput) {
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, include: { account: true } });
  if (!user) throw ApiError.unauthorized('Invalid email or password.');
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password.');
  return user;
}

export async function changePassword(user: SessionUser, input: ChangePasswordInput) {
  if (user.email.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX)) {
    throw ApiError.forbidden(
      'Demo accounts cannot change their password. Sign up with your own email to get a personal workspace.'
    );
  }
  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest('Your current password is incorrect.');
  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
}

export async function listWorkspaceMembers(accountId: string) {
  return db.user.findMany({
    where: { accountId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * OWNER invites a MEMBER by creating the account with a temporary password
 * (no email delivery required). The member signs in with it right away.
 */
export async function inviteMember(accountId: string, input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('A user with this email already exists.');
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  return db.user.create({
    data: { name: input.name.trim(), email, passwordHash, role: 'MEMBER', accountId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
}
