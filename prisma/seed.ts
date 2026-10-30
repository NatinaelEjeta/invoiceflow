/**
 * InvoiceFlow seed — deterministic demo data, FAST over remote databases.
 *
 * Strategy:
 *  - All ids are pre-generated (crypto.randomUUID) so child rows can be
 *    inserted with `createMany` without round-trips.
 *  - Only 2 sequential creates (the workspaces); everything else is a single
 *    createMany per table (users, clients, invoices, items, payments).
 *  - Totals are computed with the SAME money module the app uses, so the
 *    seeded invoices are arithmetically consistent.
 *  - Safe to re-run: existing data is cleared first.
 *
 * Run: npm run db:seed
 */
import { randomUUID, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computeTotals, formatInvoiceNumber, toCents } from '../src/server/services/money';

const db = new PrismaClient();

const NOW = new Date();
const TODAY_UTC = NOW.getUTCDate();

function utcDate(monthsAgo: number, day: number): Date {
  return new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo, Math.max(1, day)));
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
function clampPast(date: Date): Date {
  return date > NOW ? NOW : date;
}

const PRODUCTS = [
  { description: 'Website design (hours)', unitPrice: 85 },
  { description: 'Frontend development (hours)', unitPrice: 95 },
  { description: 'UI/UX consulting (hours)', unitPrice: 120 },
  { description: 'Logo & brand identity', unitPrice: 750 },
  { description: 'SEO optimization package', unitPrice: 420 },
  { description: 'Monthly maintenance retainer', unitPrice: 260 },
  { description: 'Copywriting (pages)', unitPrice: 60 },
  { description: 'Hosting & domain setup', unitPrice: 140 },
];

const QUANTITIES = [4, 10, 2, 6, 8, 3, 12, 1];
const TAX_RATES = [0, 8.5, 5, 10, 0, 20, 0, 8.5];
const METHODS = ['CARD', 'BANK_TRANSFER', 'CASH', 'OTHER'];

type Status = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

interface Planned {
  clientIdx: number;
  monthsAgo: number;
  day: number;
  status: Status;
  splitPayment?: boolean;
  partialPercent?: number;
}

// 24 invoices for the PRO workspace (Acme Studio)
const ACME_INVOICES: Planned[] = [
  // months 5-2: mostly PAID history
  ...[0, 1, 2, 3].map((i) => ({ clientIdx: i % 4, monthsAgo: 5, day: 3 + i * 5, status: 'PAID' as Status })),
  ...[0, 1, 2, 3].map((i) => ({ clientIdx: (i + 1) % 4, monthsAgo: 4, day: 2 + i * 6, status: 'PAID' as Status, splitPayment: i === 0 })),
  ...[0, 1, 2, 3].map((i) => ({ clientIdx: (i + 2) % 4, monthsAgo: 3, day: 4 + i * 5, status: 'PAID' as Status })),
  ...[0, 1, 2, 3].map((i) => ({ clientIdx: (i + 3) % 4, monthsAgo: 2, day: 2 + i * 6, status: 'PAID' as Status })),
  // month 1
  { clientIdx: 0, monthsAgo: 1, day: 5, status: 'PAID' },
  { clientIdx: 2, monthsAgo: 1, day: 12, status: 'PAID' },
  { clientIdx: 1, monthsAgo: 1, day: 9, status: 'OVERDUE', partialPercent: 30 },
  { clientIdx: 3, monthsAgo: 1, day: 15, status: 'VOID' },
  // current month
  { clientIdx: 1, monthsAgo: 0, day: 3, status: 'SENT', partialPercent: 60 },
  { clientIdx: 2, monthsAgo: 0, day: 6, status: 'SENT' },
  { clientIdx: 0, monthsAgo: 0, day: 8, status: 'DRAFT' },
  { clientIdx: 3, monthsAgo: 0, day: 10, status: 'DRAFT' },
];

// 16 invoices for the FREE workspace (Bright Freelance) — 9 created this
// calendar month, i.e. 9/10 used, one free slot left.
const BRIGHT_INVOICES: Planned[] = [
  { clientIdx: 0, monthsAgo: 5, day: 6, status: 'PAID' },
  { clientIdx: 1, monthsAgo: 5, day: 18, status: 'PAID' },
  { clientIdx: 2, monthsAgo: 4, day: 7, status: 'PAID' },
  { clientIdx: 3, monthsAgo: 4, day: 20, status: 'PAID' },
  { clientIdx: 1, monthsAgo: 3, day: 9, status: 'PAID' },
  { clientIdx: 0, monthsAgo: 2, day: 10, status: 'OVERDUE', partialPercent: 30 },
  { clientIdx: 2, monthsAgo: 1, day: 8, status: 'SENT', partialPercent: 50 },
  { clientIdx: 0, monthsAgo: 0, day: 2, status: 'PAID' },
  { clientIdx: 1, monthsAgo: 0, day: 4, status: 'PAID' },
  { clientIdx: 2, monthsAgo: 0, day: 5, status: 'SENT' },
  { clientIdx: 3, monthsAgo: 0, day: 6, status: 'SENT', partialPercent: 40 },
  { clientIdx: 0, monthsAgo: 0, day: 7, status: 'SENT' },
  { clientIdx: 1, monthsAgo: 0, day: 9, status: 'SENT' },
  { clientIdx: 2, monthsAgo: 0, day: 11, status: 'DRAFT' },
  { clientIdx: 3, monthsAgo: 0, day: 12, status: 'DRAFT' },
  { clientIdx: 1, monthsAgo: 0, day: 13, status: 'VOID' },
];

const WORKSPACES = [
  {
    id: randomUUID(),
    name: 'Acme Studio',
    plan: 'PRO',
    logoText: 'AS',
    defaultCurrency: 'USD',
    defaultTaxRate: 8.5,
    footerNote: 'Thank you for your business — Acme Studio',
    planned: ACME_INVOICES,
    clients: [
      { id: randomUUID(), name: 'Northwind Traders', email: 'accounts@northwindtraders.example', company: 'Northwind Traders Ltd', address: '221B Baker Street, London, UK', taxNumber: 'GB123456789', archived: false },
      { id: randomUUID(), name: 'Globex Corporation', email: 'ap@globexcorp.example', company: 'Globex Corporation', address: '742 Evergreen Terrace, Springfield, US', taxNumber: 'US987654321', archived: false },
      { id: randomUUID(), name: 'Initech LLC', email: 'billing@initech.example', company: 'Initech LLC', address: '4120 Freidrich Lane, Austin, US', taxNumber: 'US456789123', archived: false },
      { id: randomUUID(), name: 'Umbrella Design', email: 'hello@umbrelladesign.example', company: 'Umbrella Design Studio', address: '88 Harbour Road, Sydney, AU', taxNumber: 'AU112233445', archived: true },
    ],
  },
  {
    id: randomUUID(),
    name: 'Bright Freelance',
    plan: 'FREE',
    logoText: 'BF',
    defaultCurrency: 'USD',
    defaultTaxRate: 5,
    footerNote: 'Payment due within 14 days via bank transfer.',
    planned: BRIGHT_INVOICES,
    clients: [
      { id: randomUUID(), name: 'Harper & Co', email: 'finance@harperco.example', company: 'Harper & Co', address: '10 Downing Street, London, UK', taxNumber: 'GB556677889', archived: false },
      { id: randomUUID(), name: 'Bluebird Cafe', email: 'owner@bluebirdcafe.example', company: 'Bluebird Cafe', address: '12 Elm Street, Portland, US', taxNumber: 'US334455667', archived: false },
      { id: randomUUID(), name: 'Cedar Dental', email: 'accounts@cedardental.example', company: 'Cedar Dental Clinic', address: '300 Cedar Avenue, Seattle, US', taxNumber: 'US776655443', archived: false },
      { id: randomUUID(), name: 'Oakwood Law', email: 'billing@oakwoodlaw.example', company: 'Oakwood Law Group', address: '45 Oakwood Boulevard, Chicago, US', taxNumber: 'US998877665', archived: false },
    ],
  },
];

function buildItems(invoiceIndex: number) {
  const count = 1 + (invoiceIndex % 3);
  return Array.from({ length: count }, (_, j) => {
    const product = PRODUCTS[(invoiceIndex + j * 3) % PRODUCTS.length];
    return {
      description: product.description,
      quantity: QUANTITIES[(invoiceIndex + j) % QUANTITIES.length],
      unitPriceCents: toCents(product.unitPrice),
    };
  });
}

async function main() {
  console.log('Seeding InvoiceFlow demo data...');

  // 1. Clear existing data (FK-safe order).
  await db.payment.deleteMany({});
  await db.invoiceItem.deleteMany({});
  await db.invoice.deleteMany({});
  await db.client.deleteMany({});
  await db.user.deleteMany({});
  await db.account.deleteMany({});

  // 2. Workspaces (only sequential creates in the whole seed).
  for (const ws of WORKSPACES) {
    await db.account.create({ data: { id: ws.id, name: ws.name, plan: ws.plan, logoText: ws.logoText, defaultCurrency: ws.defaultCurrency, defaultTaxRate: ws.defaultTaxRate, footerNote: ws.footerNote } });
  }

  // 3. Users — one bcrypt hash per distinct password (fast).
  const [ownerHash, memberHash, freeHash] = await Promise.all([
    bcrypt.hash('Owner123!', 10),
    bcrypt.hash('Member123!', 10),
    bcrypt.hash('Free123!', 10),
  ]);
  await db.user.createMany({
    data: [
      { name: 'Dana Reeves', email: 'owner@invoiceflow.demo', passwordHash: ownerHash, role: 'OWNER', accountId: WORKSPACES[0].id },
      { name: 'Mike Chen', email: 'member@invoiceflow.demo', passwordHash: memberHash, role: 'MEMBER', accountId: WORKSPACES[0].id },
      { name: 'Fiona Bright', email: 'free@invoiceflow.demo', passwordHash: freeHash, role: 'OWNER', accountId: WORKSPACES[1].id },
    ],
  });

  // 4. Clients.
  const clientRows = WORKSPACES.flatMap((ws, wsIdx) =>
    ws.clients.map((c) => ({ ...c, accountId: ws.id, createdAt: utcDate(6, 5 + wsIdx * 2) }))
  );
  await db.client.createMany({ data: clientRows });

  // 5. Invoices (deterministic, numbers sequential per workspace by createdAt).
  type InvoiceRow = {
    id: string; accountId: string; clientId: string; number: string; status: string;
    issueDate: Date; dueDate: Date; currency: string; taxRate: number; discountType: string;
    discountValue: number; subtotalCents: number; discountCents: number; taxCents: number;
    totalCents: number; paidCents: number; notes: string | null; publicToken: string;
    sentAt: Date | null; createdAt: Date;
  };
  const invoiceRows: InvoiceRow[] = [];
  const itemRows: { invoiceId: string; description: string; quantity: number; unitPriceCents: number; position: number }[] = [];
  const paymentRows: { invoiceId: string; amountCents: number; paidAt: Date; method: string; note: string | null }[] = [];

  for (const ws of WORKSPACES) {
    const withDates = ws.planned.map((p, i) => {
      const day = p.monthsAgo === 0 ? Math.min(p.day, TODAY_UTC) : p.day;
      const createdAt = utcDate(p.monthsAgo, day);
      return { ...p, createdAt, issueDate: createdAt, index: i };
    });
    // Sequential numbering follows chronological order of creation.
    withDates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.index - b.index);

    withDates.forEach((p, seq) => {
      const client = ws.clients[p.clientIdx];
      const invoiceId = randomUUID();
      const taxRate = TAX_RATES[p.index % TAX_RATES.length];
      const discountType = p.index % 9 === 4 ? 'PERCENT' : p.index % 11 === 6 ? 'FIXED' : 'NONE';
      const discountValue = discountType === 'PERCENT' ? 5 : discountType === 'FIXED' ? 25 : 0;

      const items = buildItems(p.index);
      items.forEach((item, position) => itemRows.push({ invoiceId, ...item, position }));

      const totals = computeTotals({ items, taxRate, discountType: discountType as 'NONE' | 'PERCENT' | 'FIXED', discountValue });
      const issueDate = p.issueDate;
      const dueDate = addDays(issueDate, 14);
      const sentAt = p.status === 'DRAFT' ? null : clampPast(addDays(issueDate, 1));
      const createdAt = p.createdAt;

      invoiceRows.push({
        id: invoiceId,
        accountId: ws.id,
        clientId: client.id,
        number: formatInvoiceNumber(seq + 1),
        status: p.status,
        issueDate,
        dueDate,
        currency: ws.defaultCurrency,
        taxRate,
        discountType,
        discountValue,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        paidCents: 0, // filled from payments below
        notes:
          p.status === 'DRAFT'
            ? 'Draft — not sent to the client yet.'
            : p.index % 3 === 0
              ? 'Thank you for your business!'
              : null,
        publicToken: randomBytes(16).toString('hex'),
        sentAt,
        createdAt,
      });

      // Payments for PAID (full, sometimes split in two) and partials.
      let paymentIndex = p.index;
      if (p.status === 'PAID') {
        const total = totals.totalCents;
        if (p.splitPayment) {
          const first = Math.round(total * 0.6);
          paymentRows.push({ invoiceId, amountCents: first, paidAt: clampPast(addDays(issueDate, 2)), method: METHODS[paymentIndex % 4], note: 'Deposit' });
          paymentRows.push({ invoiceId, amountCents: total - first, paidAt: clampPast(addDays(issueDate, 9)), method: METHODS[(paymentIndex + 1) % 4], note: 'Final payment' });
        } else {
          paymentRows.push({ invoiceId, amountCents: total, paidAt: clampPast(addDays(issueDate, 4)), method: METHODS[paymentIndex % 4], note: null });
        }
      } else if ((p.status === 'SENT' || p.status === 'OVERDUE') && p.partialPercent) {
        paymentRows.push({
          invoiceId,
          amountCents: Math.round((totals.totalCents * p.partialPercent) / 100),
          paidAt: clampPast(addDays(issueDate, 5)),
          method: METHODS[paymentIndex % 4],
          note: 'Partial payment',
        });
      }
      void paymentIndex;
    });
  }

  // Aggregate paidCents per invoice.
  const paidByInvoice = new Map<string, number>();
  for (const p of paymentRows) {
    paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + p.amountCents);
  }
  for (const inv of invoiceRows) {
    inv.paidCents = paidByInvoice.get(inv.id) ?? 0;
  }

  // 6. Batched inserts — fast even over a remote database.
  await db.invoice.createMany({ data: invoiceRows });
  await db.invoiceItem.createMany({ data: itemRows });
  await db.payment.createMany({ data: paymentRows });

  // 7. Continue numbering after the seed.
  for (const ws of WORKSPACES) {
    const count = invoiceRows.filter((i) => i.accountId === ws.id).length;
    await db.account.update({ where: { id: ws.id }, data: { nextInvoiceNumber: count + 1 } });
  }

  const stats = invoiceRows.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Created ${WORKSPACES.length} workspaces, ${clientRows.length} clients, ${invoiceRows.length} invoices (${Object.entries(stats).map(([k, v]) => `${v} ${k}`).join(', ')}), ${itemRows.length} line items, ${paymentRows.length} payments.`);
  console.log('Demo accounts:');
  console.log('  owner@invoiceflow.demo / Owner123!  (Acme Studio — OWNER, PRO)');
  console.log('  member@invoiceflow.demo / Member123! (Acme Studio — MEMBER, PRO)');
  console.log('  free@invoiceflow.demo / Free123!     (Bright Freelance — OWNER, FREE, near limits)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
