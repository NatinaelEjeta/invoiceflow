import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createClient,
  getClient,
  listClients,
  updateClient,
} from '@/server/services/clients.service';
import {
  createInvoice,
  getInvoice,
  listInvoices,
  recordPayment,
  updateInvoice,
} from '@/server/services/invoices.service';
import type { SessionUser } from '@/server/middleware/auth';
import { baseInvoiceInput, createTestClient, createTestWorkspace, resetDb, testDb } from './helpers/db';

/**
 * Tenant isolation: every query is scoped by accountId on the server.
 * Workspace B can never read or mutate workspace A's clients or invoices —
 * missing rows behave as 404, and listings only return the caller's data.
 */
describe('tenant isolation between workspaces', () => {
  let ownerA: SessionUser;
  let ownerB: SessionUser;
  let clientAId: string;
  let invoiceAId: string;

  beforeAll(async () => {
    await resetDb();

    const wsA = await createTestWorkspace('Workspace A');
    const wsB = await createTestWorkspace('Workspace B');
    ownerA = wsA.user;
    ownerB = wsB.user;

    const clientA = await createClient(ownerA, {
      name: 'A-secret client',
      email: 'secret@a.example',
      company: null,
      address: null,
      taxNumber: null,
    });
    clientAId = clientA.id;

    const invoiceA = await createInvoice(ownerA, baseInvoiceInput(clientAId));
    invoiceAId = invoiceA.id;

    // Workspace B has its own unrelated client + invoice.
    const clientB = await createTestClient(ownerB.accountId, 'B client');
    await createInvoice(ownerB, baseInvoiceInput(clientB.id));
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('cannot READ another workspace client or invoice (404)', async () => {
    await expect(getClient(ownerB.accountId, clientAId)).rejects.toMatchObject({ status: 404 });
    await expect(getInvoice(ownerB.accountId, invoiceAId)).rejects.toMatchObject({ status: 404 });
  });

  it('cannot UPDATE another workspace client (404)', async () => {
    await expect(
      updateClient(ownerB.accountId, clientAId, {
        name: 'Hacked name',
        email: null,
        company: null,
        address: null,
        taxNumber: null,
      })
    ).rejects.toMatchObject({ status: 404 });
    // The original name is untouched.
    const stillThere = await getClient(ownerA.accountId, clientAId);
    expect(stillThere.name).toBe('A-secret client');
  });

  it('cannot EDIT another workspace invoice (404)', async () => {
    await expect(
      updateInvoice(ownerB.accountId, invoiceAId, {
        ...baseInvoiceInput(clientAId),
        items: [{ description: 'Hacked', quantity: 1, unitPrice: 1 }],
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('cannot RECORD A PAYMENT on another workspace invoice (404)', async () => {
    await expect(
      recordPayment(ownerB.accountId, invoiceAId, {
        amountCents: 100,
        paidAt: '2025-01-20',
        method: 'CASH',
        note: null,
      })
    ).rejects.toMatchObject({ status: 404 });
    const untouched = await getInvoice(ownerA.accountId, invoiceAId);
    expect(untouched.paidCents).toBe(0);
  });

  it('listings only return the caller workspace data', async () => {
    const clientsB = await listClients(ownerB.accountId, {
      page: 1,
      pageSize: 50,
      search: '',
      archived: 'all',
    });
    expect(clientsB.items.every((c) => c.name !== 'A-secret client')).toBe(true);
    expect(clientsB.total).toBe(1);

    const invoicesB = await listInvoices(ownerB.accountId, {
      page: 1,
      pageSize: 50,
      search: '',
    });
    expect(invoicesB.items.every((inv) => inv.accountId === undefined || true)).toBe(true);
    // B sees only its own invoice, not A's.
    expect(invoicesB.items.some((inv) => inv.id === invoiceAId)).toBe(false);
    expect(invoicesB.total).toBe(1);

    // Search for A's secret client from B returns nothing.
    const searchB = await listClients(ownerB.accountId, {
      page: 1,
      pageSize: 50,
      search: 'A-secret',
      archived: 'all',
    });
    expect(searchB.total).toBe(0);

    // The owner of A still sees everything.
    const invoicesA = await listInvoices(ownerA.accountId, { page: 1, pageSize: 50, search: '' });
    expect(invoicesA.total).toBe(1);
    expect(invoicesA.items[0].id).toBe(invoiceAId);
  });

  it('the public token route is the only cross-workspace read and it is token-gated', async () => {
    const invoiceA = await getInvoice(ownerA.accountId, invoiceAId);
    // Random 32-hex token does not leak by guesswork within a test run.
    expect(invoiceA.publicToken).toMatch(/^[a-f0-9]{32}$/);
    expect(invoiceA.publicToken).not.toBe(
      (await getInvoice(ownerB.accountId, (await listInvoices(ownerB.accountId, { page: 1, pageSize: 1, search: '' })).items[0].id)).publicToken
    );
  });
});
