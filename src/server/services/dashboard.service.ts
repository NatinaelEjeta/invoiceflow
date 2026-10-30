import { db } from '@/lib/db';
import { ApiError } from '@/server/errors';
import type { SessionUser } from '@/server/middleware/auth';
import { FREE_PLAN_LIMITS, isPro, startOfUtcMonth } from '@/server/services/plans';

// ---------------------------------------------------------------------------
// Dashboard statistics (all scoped by accountId)
// ---------------------------------------------------------------------------

export interface DashboardData {
  monthlyRevenue: { month: string; totalCents: number }[];
  outstandingCents: number;
  overdueCents: number;
  paidThisMonthCents: number;
  activeClients: number;
  invoicesThisMonth: number;
  topClients: { clientId: string; name: string; totalCents: number }[];
  recentInvoices: {
    id: string;
    number: string;
    status: string;
    clientName: string;
    totalCents: number;
    paidCents: number;
    currency: string;
    issueDate: Date;
    dueDate: Date;
  }[];
  plan: string;
}

function utcMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getDashboard(accountId: string): Promise<DashboardData> {
  const now = new Date();
  const thisMonth = utcMonthKey(now);
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [invoices, payments, activeClients, recentRaw, invoicesThisMonth] = await Promise.all([
    db.invoice.findMany({
      where: { accountId },
      select: { clientId: true, client: { select: { name: true } }, status: true, totalCents: true, paidCents: true },
    }),
    db.payment.findMany({
      where: { invoice: { accountId }, paidAt: { gte: windowStart } },
      select: { amountCents: true, paidAt: true },
    }),
    db.client.count({ where: { accountId, archived: false } }),
    db.invoice.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { client: { select: { name: true } } },
    }),
    db.invoice.count({ where: { accountId, createdAt: { gte: startOfUtcMonth(now) } } }),
  ]);

  // Revenue per month (cash collected from payments) for the last 6 months.
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(utcMonthKey(d));
  }
  const monthlyRevenue = monthKeys.map((month) => ({
    month,
    totalCents: payments
      .filter((p) => utcMonthKey(p.paidAt) === month)
      .reduce((sum, p) => sum + p.amountCents, 0),
  }));

  const openStatuses = ['SENT', 'OVERDUE'];
  const outstandingCents = invoices
    .filter((i) => openStatuses.includes(i.status))
    .reduce((sum, i) => sum + Math.max(0, i.totalCents - i.paidCents), 0);
  const overdueCents = invoices
    .filter((i) => i.status === 'OVERDUE')
    .reduce((sum, i) => sum + Math.max(0, i.totalCents - i.paidCents), 0);
  const paidThisMonthCents = payments
    .filter((p) => utcMonthKey(p.paidAt) === thisMonth)
    .reduce((sum, p) => sum + p.amountCents, 0);

  // Top clients by total billed amount.
  const billed = new Map<string, { name: string; totalCents: number }>();
  for (const inv of invoices) {
    const entry = billed.get(inv.clientId) ?? { name: inv.client.name, totalCents: 0 };
    entry.totalCents += inv.totalCents;
    billed.set(inv.clientId, entry);
  }
  const topClients = [...billed.entries()]
    .map(([clientId, v]) => ({ clientId, name: v.name, totalCents: v.totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5);

  const recentInvoices = recentRaw.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    clientName: inv.client.name,
    totalCents: inv.totalCents,
    paidCents: inv.paidCents,
    currency: inv.currency,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
  }));

  return {
    monthlyRevenue,
    outstandingCents,
    overdueCents,
    paidThisMonthCents,
    activeClients,
    invoicesThisMonth,
    topClients,
    recentInvoices,
    plan: '',
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSettings(account: SessionUser['account']) {
  return {
    id: account.id,
    name: account.name,
    logoText: account.logoText,
    defaultCurrency: account.defaultCurrency,
    defaultTaxRate: account.defaultTaxRate,
    footerNote: account.footerNote,
    plan: account.plan,
    defaultCurrencyIsEditable: true,
  };
}

export async function updateSettings(accountId: string, input: SettingsUpdate) {
  const account = await db.account.update({
    where: { id: accountId },
    data: {
      name: input.name,
      logoText: input.logoText,
      defaultCurrency: input.defaultCurrency,
      defaultTaxRate: input.defaultTaxRate,
      footerNote: input.footerNote,
    },
  });
  return getSettings(account);
}

interface SettingsUpdate {
  name: string;
  logoText: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  footerNote: string;
}

// ---------------------------------------------------------------------------
// Billing info (plan + usage used by the billing page and the sidebar badge)
// ---------------------------------------------------------------------------

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface BillingInfo {
  plan: 'FREE' | 'PRO';
  subscriptionStatus: string | null;
  stripeConfigured: boolean;
  hasStripeCustomer: boolean;
  usage: {
    activeClients: number;
    maxActiveClients: number | null;
    invoicesThisMonth: number;
    maxInvoicesPerMonth: number | null;
  };
}

export async function getBillingInfo(account: SessionUser['account']): Promise<BillingInfo> {
  const [activeClients, invoicesThisMonth] = await Promise.all([
    db.client.count({ where: { accountId: account.id, archived: false } }),
    db.invoice.count({ where: { accountId: account.id, createdAt: { gte: startOfUtcMonth() } } }),
  ]);

  return {
    plan: account.plan === 'PRO' ? 'PRO' : 'FREE',
    subscriptionStatus: account.subscriptionStatus,
    stripeConfigured: isStripeConfigured(),
    hasStripeCustomer: Boolean(account.stripeCustomerId),
    usage: {
      activeClients,
      maxActiveClients: isPro(account.plan) ? null : FREE_PLAN_LIMITS.maxActiveClients,
      invoicesThisMonth,
      maxInvoicesPerMonth: isPro(account.plan) ? null : FREE_PLAN_LIMITS.maxInvoicesPerMonth,
    },
  };
}
