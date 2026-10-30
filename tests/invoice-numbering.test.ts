import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInvoice } from '@/server/services/invoices.service';
import { formatInvoiceNumber } from '@/server/services/money';
import type { InvoiceCreateInput } from '@/server/validation';
import { baseInvoiceInput, createTestClient, createTestWorkspace, resetDb, testDb } from './helpers/db';

/**
 * Invoice numbering: per-workspace sequential (INV-0001, INV-0002, ...) and
 * UNIQUE, even when several invoices are created concurrently — the number is
 * reserved by an atomic increment inside the creation transaction.
 */
describe('invoice numbering', () => {
  let user: Awaited<ReturnType<typeof createTestWorkspace>>['user'];
  let clientId: string;

  beforeAll(async () => {
    await resetDb();
    const ws = await createTestWorkspace('Numbering Co');
    user = ws.user;
    clientId = (await createTestClient(user.accountId)).id;
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('allocates sequential, unique numbers under concurrent requests', async () => {
    const input = (n: number): InvoiceCreateInput =>
      ({
        ...baseInvoiceInput(clientId),
        items: [{ description: `Item ${n}`, quantity: 1, unitPrice: 50 }],
      }) as InvoiceCreateInput;

    // 5 concurrent creations — the heart of the numbering guarantee.
    const created = await Promise.all([
      createInvoice(user, input(1)),
      createInvoice(user, input(2)),
      createInvoice(user, input(3)),
      createInvoice(user, input(4)),
      createInvoice(user, input(5)),
    ]);

    const numbers = created.map((inv) => inv.number);
    expect(new Set(numbers).size).toBe(5); // all unique
    expect([...numbers].sort()).toEqual([
      'INV-0001',
      'INV-0002',
      'INV-0003',
      'INV-0004',
      'INV-0005',
    ]);

    // The next invoice continues the sequence.
    const sixth = await createInvoice(user, input(6));
    expect(sixth.number).toBe('INV-0006');

    // The workspace counter is ahead by exactly 6.
    const account = await testDb.account.findUniqueOrThrow({ where: { id: user.accountId } });
    expect(account.nextInvoiceNumber).toBe(7);
  });

  it('formats numbers with the INV- prefix', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-0001');
  });

  it('stores totals computed on the server from integer cents', async () => {
    const invoice = await createInvoice(user, {
      ...baseInvoiceInput(clientId),
      taxRate: 10,
      discountType: 'PERCENT',
      discountValue: 10,
      items: [{ description: 'Design', quantity: 2, unitPrice: 100 }],
    });
    // subtotal 20000, discount 2000, tax 1800, total 19800
    expect(invoice.subtotalCents).toBe(20000);
    expect(invoice.discountCents).toBe(2000);
    expect(invoice.taxCents).toBe(1800);
    expect(invoice.totalCents).toBe(19800);
  });
});
