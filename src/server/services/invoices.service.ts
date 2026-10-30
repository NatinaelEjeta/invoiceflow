import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { utcMidnight } from '@/lib/dates';
import { ApiError } from '@/server/errors';
import type { SessionUser } from '@/server/middleware/auth';
import {
  balanceCents,
  computeTotals,
  formatInvoiceNumber,
  toCents,
  type DiscountType,
} from '@/server/services/money';
import { checkInvoiceLimit, startOfUtcMonth } from '@/server/services/plans';
import { canTransition } from '@/server/services/status';
import { sendEmail, buildInvoiceEmailHtml, type EmailResult } from '@/server/services/email.service';
import type { InvoiceCreateInput, InvoiceListQuery, PaymentCreateInput } from '@/server/validation';

/** Shared include so invoice payloads always look the same to the frontend. */
export const invoiceInclude = {
  client: true,
  items: { orderBy: { position: 'asc' as const } },
  payments: { orderBy: { paidAt: 'desc' as const } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export interface WorkspaceInfo {
  name: string;
  logoText: string;
  footerNote: string;
}

function workspaceInfo(account: { name: string; logoText: string; footerNote: string }): WorkspaceInfo {
  return { name: account.name, logoText: account.logoText, footerNote: account.footerNote };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/**
 * List invoices with search/status filters + pagination.
 * The search runs in JavaScript (see clients.service.ts) so behavior is
 * identical on SQLite and PostgreSQL. Every query is scoped by accountId.
 */
export async function listInvoices(accountId: string, query: InvoiceListQuery) {
  const rows = await db.invoice.findMany({
    where: {
      accountId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, name: true } } },
  });

  const search = query.search.trim().toLowerCase();
  const filtered = search
    ? rows.filter(
        (inv) =>
          inv.number.toLowerCase().includes(search) ||
          inv.client.name.toLowerCase().includes(search)
      )
    : rows;

  // "UNPAID" is a convenience filter: SENT or OVERDUE with a remaining balance.
  const finalItems = query.status === 'UNPAID'
    ? filtered.filter((inv) => (inv.status === 'SENT' || inv.status === 'OVERDUE') && inv.paidCents < inv.totalCents)
    : filtered;

  const total = finalItems.length;
  const start = (query.page - 1) * query.pageSize;
  return { items: finalItems.slice(start, start + query.pageSize), total, page: query.page, pageSize: query.pageSize };
}

export async function getInvoice(accountId: string, id: string): Promise<InvoiceWithRelations> {
  const invoice = await db.invoice.findFirst({ where: { id, accountId }, include: invoiceInclude });
  if (!invoice) throw ApiError.notFound('Invoice not found.');
  return invoice;
}

// ---------------------------------------------------------------------------
// Create / edit (numbers are sequential & unique per workspace)
// ---------------------------------------------------------------------------

function buildItemRows(items: InvoiceCreateInput['items']) {
  return items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: toCents(item.unitPrice),
    position: index,
  }));
}

function computeForInput(input: InvoiceCreateInput) {
  const itemRows = buildItemRows(input.items);
  const totals = computeTotals({
    items: itemRows,
    taxRate: input.taxRate,
    discountType: input.discountType as DiscountType,
    discountValue: input.discountValue,
  });
  return { itemRows, totals };
}

/**
 * Create a DRAFT invoice. The sequential per-workspace number is allocated
 * INSIDE the same transaction that creates the invoice:
 *
 *   tx.account.update({ data: { nextInvoiceNumber: { increment: 1 } } })
 *
 * The atomic increment takes a row-level lock (Postgres) / serializes
 * (SQLite), so two concurrent requests can never read the same counter value
 * — numbers are strictly sequential and unique per workspace (enforced again
 * by @@unique([accountId, number]) as a last resort).
 */
export async function createInvoice(user: SessionUser, input: InvoiceCreateInput) {
  const account = user.account;

  // FREE plan: max 10 invoices per calendar month (by creation date, UTC).
  const createdThisMonth = await db.invoice.count({
    where: { accountId: account.id, createdAt: { gte: startOfUtcMonth() } },
  });
  const check = checkInvoiceLimit(account.plan, createdThisMonth);
  if (!check.allowed) throw ApiError.paymentRequired(check.reason);

  const client = await db.client.findFirst({ where: { id: input.clientId, accountId: account.id } });
  if (!client) throw ApiError.notFound('Client not found.');
  if (client.archived) throw ApiError.badRequest('This client is archived. Unarchive them first.');

  const { itemRows, totals } = computeForInput(input);
  const issueDate = utcMidnight(input.issueDate);
  const dueDate = utcMidnight(input.dueDate);

  return db.$transaction(
    async (tx) => {
      const updated = await tx.account.update({
        where: { id: account.id },
        data: { nextInvoiceNumber: { increment: 1 } },
      });
      return tx.invoice.create({
        data: {
          accountId: account.id,
          clientId: client.id,
          number: formatInvoiceNumber(updated.nextInvoiceNumber - 1),
          status: 'DRAFT',
          issueDate,
          dueDate,
          currency: input.currency,
          taxRate: input.taxRate,
          discountType: input.discountType,
          discountValue: input.discountValue,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          notes: input.notes,
          publicToken: randomBytes(16).toString('hex'),
          items: { create: itemRows },
        },
        include: invoiceInclude,
      });
    },
    // Slightly roomier than the defaults so contention on a remote database
    // (Neon) never aborts a legitimate numbering reservation.
    { maxWait: 5_000, timeout: 15_000 }
  );
}

/** Only DRAFT invoices are editable — the server enforces this. */
export async function updateInvoice(accountId: string, id: string, input: InvoiceCreateInput) {
  const invoice = await getInvoice(accountId, id);
  if (invoice.status !== 'DRAFT') {
    throw ApiError.conflict('Only draft invoices can be edited. Void or edit a duplicate instead.');
  }
  const client = await db.client.findFirst({ where: { id: input.clientId, accountId } });
  if (!client) throw ApiError.notFound('Client not found.');
  if (client.archived) throw ApiError.badRequest('This client is archived. Unarchive them first.');

  const { itemRows, totals } = computeForInput(input);
  const issueDate = utcMidnight(input.issueDate);
  const dueDate = utcMidnight(input.dueDate);

  return db.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    return tx.invoice.update({
      where: { id },
      data: {
        clientId: client.id,
        issueDate,
        dueDate,
        currency: input.currency,
        taxRate: input.taxRate,
        discountType: input.discountType,
        discountValue: input.discountValue,
        notes: input.notes,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        items: { create: itemRows },
      },
      include: invoiceInclude,
    });
  });
}

// ---------------------------------------------------------------------------
// Status transitions (server-enforced state machine)
// ---------------------------------------------------------------------------

export async function updateInvoiceStatus(accountId: string, id: string, nextStatus: string) {
  const invoice = await getInvoice(accountId, id);
  if (!canTransition(invoice.status, nextStatus)) {
    throw ApiError.conflict(`An invoice cannot change from ${invoice.status} to ${nextStatus}.`);
  }
  return db.invoice.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(nextStatus === 'SENT' && !invoice.sentAt ? { sentAt: new Date() } : {}),
    },
    include: invoiceInclude,
  });
}

/** Daily cron: past-due SENT invoices become OVERDUE. Returns how many changed. */
export async function markOverdueInvoices(): Promise<number> {
  const result = await db.invoice.updateMany({
    where: { status: 'SENT', dueDate: { lt: new Date() } },
    data: { status: 'OVERDUE' },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// Payments (full or partial; invoice becomes PAID when balance reaches zero)
// ---------------------------------------------------------------------------

export async function recordPayment(accountId: string, id: string, input: PaymentCreateInput) {
  const invoice = await getInvoice(accountId, id);
  if (invoice.status === 'DRAFT') {
    throw ApiError.conflict('Send the invoice before recording payments.');
  }
  if (invoice.status === 'PAID') throw ApiError.conflict('This invoice is already fully paid.');
  if (invoice.status === 'VOID') throw ApiError.conflict('Payments cannot be recorded on a void invoice.');

  // Defense-in-depth: the Zod schema also enforces this, but the server
  // never trusts its callers — not even its own controllers.
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw ApiError.badRequest('Payment amount must be a positive amount.');
  }

  const remaining = balanceCents(invoice.totalCents, invoice.paidCents);
  if (input.amountCents > remaining) {
    throw ApiError.badRequest(
      `Payment exceeds the outstanding balance (${(remaining / 100).toFixed(2)} ${invoice.currency}).`
    );
  }

  return db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: id,
        amountCents: input.amountCents,
        paidAt: utcMidnight(input.paidAt),
        method: input.method,
        note: input.note,
      },
    });
    const paidCents = invoice.paidCents + input.amountCents;
    const status = paidCents >= invoice.totalCents ? 'PAID' : invoice.status;
    return tx.invoice.update({ where: { id }, data: { paidCents, status }, include: invoiceInclude });
  });
}

// ---------------------------------------------------------------------------
// Email + public share link
// ---------------------------------------------------------------------------

/**
 * Email the invoice to the client. Sending a DRAFT moves it to SENT.
 * Uses Resend when RESEND_API_KEY is set, otherwise logs to the console so
 * the whole flow works without any keys.
 */
export async function sendInvoiceByEmail(user: SessionUser, id: string) {
  const invoice = await getInvoice(user.accountId, id);
  if (invoice.status === 'PAID') throw ApiError.conflict('This invoice is already paid — no need to send it.');
  if (invoice.status === 'VOID') throw ApiError.conflict('Void invoices cannot be sent.');
  if (!invoice.client.email) {
    throw ApiError.badRequest('This client has no email address. Add one on the client first.');
  }

  let current = invoice;
  if (invoice.status === 'DRAFT') {
    current = await updateInvoiceStatus(user.accountId, id, 'SENT');
  }

  const subject = `Invoice ${current.number} from ${user.account.name}`;
  const html = buildInvoiceEmailHtml({
    workspaceName: user.account.name,
    clientName: current.client.name,
    invoiceNumber: current.number,
    dueDate: current.dueDate.toISOString(),
    currency: current.currency,
    totalCents: current.totalCents,
    balanceCents: balanceCents(current.totalCents, current.paidCents),
    publicUrl: `${process.env.APP_URL ?? ''}/i/${current.publicToken}`,
  });
  const result: EmailResult = await sendEmail({ to: invoice.client.email, subject, html });
  return { invoice: current, email: result };
}

/** Public read-only page data (no auth) — found by the random public token. */
export async function getPublicInvoice(token: string) {
  return db.invoice.findUnique({
    where: { publicToken: token },
    include: {
      ...invoiceInclude,
      account: { select: { name: true, logoText: true, footerNote: true } },
    },
  });
}
