/**
 * Plan limits — pure decision logic, easy to unit-test.
 *
 * FREE:  max 5 ACTIVE clients and max 10 invoices created per calendar month.
 * PRO:   unlimited.
 *
 * The thin wrappers that COUNT current usage live in the feature services;
 * this module only decides whether an action is allowed, given the counts.
 */

export const FREE_PLAN_LIMITS = {
  maxActiveClients: 5,
  maxInvoicesPerMonth: 10,
} as const;

export type PlanCheck = { allowed: true } | { allowed: false; reason: string };

export function isPro(plan: string): boolean {
  return plan === 'PRO';
}

/** First day (00:00 UTC) of the month containing `date`. */
export function startOfUtcMonth(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** First day (00:00 UTC) of the month `monthsBack` months before `date`. */
export function startOfUtcMonthOffset(date: Date, monthsBack: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1));
}

export function checkClientLimit(plan: string, activeClientCount: number): PlanCheck {
  if (isPro(plan)) return { allowed: true };
  if (activeClientCount >= FREE_PLAN_LIMITS.maxActiveClients) {
    return {
      allowed: false,
      reason:
        `Your FREE plan allows up to ${FREE_PLAN_LIMITS.maxActiveClients} active clients. ` +
        'Archive a client or upgrade to PRO for unlimited clients.',
    };
  }
  return { allowed: true };
}

export function checkInvoiceLimit(plan: string, invoicesCreatedThisMonth: number): PlanCheck {
  if (isPro(plan)) return { allowed: true };
  if (invoicesCreatedThisMonth >= FREE_PLAN_LIMITS.maxInvoicesPerMonth) {
    return {
      allowed: false,
      reason:
        `Your FREE plan allows up to ${FREE_PLAN_LIMITS.maxInvoicesPerMonth} invoices per calendar month. ` +
        'Upgrade to PRO for unlimited invoices.',
    };
  }
  return { allowed: true };
}
