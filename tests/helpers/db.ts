import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { SessionUser } from '@/server/middleware/auth';

/**
 * Test helpers: a Prisma client bound to the dedicated test database plus
 * small factory functions. The DATABASE_URL env (set by vitest.config.ts)
 * already points the app's own `db` singleton at the same file, so services
 * under test operate on the test database.
 */

export const TEST_DB_URL =
  'file:' + path.join(process.cwd(), 'db', 'vitest.db').replace(/\\/g, '/') + '?connection_limit=1';

export const testDb = new PrismaClient({ datasourceUrl: TEST_DB_URL });

/** Delete all rows in FK-safe order. */
export async function resetDb(): Promise<void> {
  await testDb.payment.deleteMany();
  await testDb.invoiceItem.deleteMany();
  await testDb.invoice.deleteMany();
  await testDb.client.deleteMany();
  await testDb.user.deleteMany();
  await testDb.account.deleteMany();
}

export async function createTestWorkspace(name: string): Promise<{
  account: { id: string; plan: string; name: string; defaultCurrency: string; defaultTaxRate: number; footerNote: string; logoText: string; nextInvoiceNumber: number };
  user: SessionUser;
}> {
  const account = await testDb.account.create({
    data: { name, logoText: name.slice(0, 2).toUpperCase() },
  });
  const user = await testDb.user.create({
    data: {
      name: `${name} Owner`,
      email: `${name.toLowerCase().replace(/\s+/g, '-')}-owner@test.example`,
      passwordHash: 'test-hash',
      role: 'OWNER',
      accountId: account.id,
    },
    include: { account: true },
  });
  return { account, user: user as SessionUser };
}

export async function createTestClient(accountId: string, name = 'Test Client') {
  return testDb.client.create({ data: { name, accountId } });
}

export const baseInvoiceInput = (clientId: string) => ({
  clientId,
  issueDate: '2025-01-01',
  dueDate: '2025-01-15',
  currency: 'USD',
  taxRate: 0,
  discountType: 'NONE' as const,
  discountValue: 0,
  notes: null as string | null,
  items: [{ description: 'Consulting (hours)', quantity: 2, unitPrice: 100 }],
});
