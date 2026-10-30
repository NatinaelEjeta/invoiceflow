import { db } from '@/lib/db';
import { ApiError } from '@/server/errors';
import type { SessionUser } from '@/server/middleware/auth';
import { checkClientLimit } from '@/server/services/plans';
import type { ClientCreateInput, ClientListQuery, ClientUpdateInput } from '@/server/validation';

function getWhere(accountId: string) {
  return { accountId };
}

/**
 * List clients with search + pagination.
 *
 * NOTE ON PORTABILITY: Prisma `contains` is case-sensitive on PostgreSQL but
 * case-insensitive on SQLite (LIKE semantics differ). To keep identical
 * behavior in development and production we filter the (small, per-workspace)
 * set in JavaScript instead of using `mode: 'insensitive'`, which is a
 * Postgres-only feature. Workspace datasets are scoped and small, so this is
 * fast and keeps tenant isolation intact.
 */
export async function listClients(accountId: string, query: ClientListQuery) {
  const rows = await db.client.findMany({
    where: {
      ...getWhere(accountId),
      ...(query.archived === 'all' ? {} : { archived: query.archived === 'true' }),
    },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { invoices: true } } },
  });

  const search = query.search.trim().toLowerCase();
  const filtered = search
    ? rows.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          (c.company ?? '').toLowerCase().includes(search) ||
          (c.email ?? '').toLowerCase().includes(search)
      )
    : rows;

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  return {
    items: filtered.slice(start, start + query.pageSize),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getClient(accountId: string, id: string) {
  const client = await db.client.findFirst({ where: { id, accountId } });
  if (!client) throw ApiError.notFound('Client not found.');
  return client;
}

export async function createClient(user: SessionUser, input: ClientCreateInput) {
  const activeCount = await db.client.count({
    where: { accountId: user.accountId, archived: false },
  });
  const check = checkClientLimit(user.account.plan, activeCount);
  if (!check.allowed) throw ApiError.paymentRequired(check.reason);

  return db.client.create({ data: { ...input, accountId: user.accountId } });
}

/** Update and archive are the same server-side operation (archived flag). */
export async function updateClient(accountId: string, id: string, input: ClientUpdateInput) {
  await getClient(accountId, id);
  const { archived, ...fields } = input;
  return db.client.update({
    where: { id },
    data: { ...fields, ...(archived === undefined ? {} : { archived }) },
  });
}
