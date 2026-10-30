import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInvoice, recordPayment, updateInvoiceStatus } from '@/server/services/invoices.service';
import type { SessionUser } from '@/server/middleware/auth';
import { ApiError } from '@/server/errors';
import type { PaymentCreateInput } from '@/server/validation';
import { baseInvoiceInput, createTestClient, createTestWorkspace, resetDb, testDb } from './helpers/db';

/**
 * Payments: partial payments keep the invoice open; the invoice becomes PAID
 * the moment the balance reaches zero; overpayments and payments on
 * DRAFT/PAID/VOID invoices are rejected. PAID is terminal (no going back).
 */
describe('payments and status transitions', () => {
  let user: SessionUser;
  let clientId: string;
  let sentInvoiceId: string;

  const payment = (amountCents: number): PaymentCreateInput => ({
    amountCents,
    paidAt: '2025-01-20',
    method: 'CARD',
    note: null,
  });

  beforeAll(async () => {
    await resetDb();
    const ws = await createTestWorkspace('Payments Co');
    user = ws.user;
    clientId = (await createTestClient(user.accountId)).id;

    // $200 subtotal + 10% tax = $220.00 -> 22000 cents
    const invoice = await createInvoice(user, {
      ...baseInvoiceInput(clientId),
      taxRate: 10,
      items: [{ description: 'Work', quantity: 2, unitPrice: 100 }],
    });
    sentInvoiceId = invoice.id;
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('rejects payments on a DRAFT invoice', async () => {
    await expect(recordPayment(user.accountId, sentInvoiceId, payment(1000))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('applies a partial payment and keeps the invoice SENT', async () => {
    await updateInvoiceStatus(user.accountId, sentInvoiceId, 'SENT');
    const invoice = await recordPayment(user.accountId, sentInvoiceId, payment(10000));

    expect(invoice.status).toBe('SENT');
    expect(invoice.paidCents).toBe(10000);
    expect(invoice.payments).toHaveLength(1);
    expect(invoice.payments[0].amountCents).toBe(10000);
  });

  it('rejects a payment larger than the outstanding balance', async () => {
    await expect(recordPayment(user.accountId, sentInvoiceId, payment(12001))).rejects.toMatchObject({
      status: 400,
    });
  });

  it('marks the invoice PAID exactly when the balance reaches zero', async () => {
    const invoice = await recordPayment(user.accountId, sentInvoiceId, payment(12000));
    expect(invoice.status).toBe('PAID');
    expect(invoice.paidCents).toBe(22000);
    expect(invoice.payments).toHaveLength(2);
  });

  it('rejects additional payments once PAID', async () => {
    await expect(recordPayment(user.accountId, sentInvoiceId, payment(1))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('PAID is terminal: no transition back to DRAFT or anything else', async () => {
    await expect(updateInvoiceStatus(user.accountId, sentInvoiceId, 'DRAFT')).rejects.toMatchObject({
      status: 409,
    });
    await expect(updateInvoiceStatus(user.accountId, sentInvoiceId, 'VOID')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('rejects non-positive payment amounts', async () => {
    const invoice = await createInvoice(user, baseInvoiceInput(clientId));
    await updateInvoiceStatus(user.accountId, invoice.id, 'SENT');
    await expect(recordPayment(user.accountId, invoice.id, payment(0))).rejects.toBeInstanceOf(ApiError);
  });

  it('records the payment method and note', async () => {
    const invoice = await createInvoice(user, baseInvoiceInput(clientId));
    await updateInvoiceStatus(user.accountId, invoice.id, 'SENT');
    const after = await recordPayment(user.accountId, invoice.id, {
      amountCents: 5000,
      paidAt: '2025-02-02',
      method: 'BANK_TRANSFER',
      note: 'Wire from client',
    });
    const last = after.payments[0];
    expect(last.method).toBe('BANK_TRANSFER');
    expect(last.note).toBe('Wire from client');
  });
});
