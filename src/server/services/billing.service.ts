import { db } from '@/lib/db';
import { ApiError } from '@/server/errors';
import type { SessionUser } from '@/server/middleware/auth';
import { isStripeConfigured } from '@/server/services/dashboard.service';
import type { StripeEvent } from '@/server/services/stripe-signature';

/**
 * Billing — Stripe subscription mode with a fully working MOCK BILLING MODE.
 *
 * When STRIPE_SECRET_KEY is missing, "Upgrade to Pro" switches the workspace
 * to PRO instantly (demo billing), so plan limits can be demonstrated
 * without any Stripe keys. When keys are present we talk to the Stripe REST
 * API with plain fetch (no SDK needed).
 */

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeRequest(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw ApiError.badRequest('Stripe is not configured.');
  const body = new URLSearchParams(params);
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = (data?.error as { message?: string } | undefined)?.message;
    throw ApiError.badRequest(message || 'The Stripe request failed. Check your Stripe settings.');
  }
  return data;
}

function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export interface UpgradeResult {
  demo: boolean;
  url?: string;
}

/**
 * OWNER clicks "Upgrade to Pro".
 * - Stripe configured  -> creates a Checkout Session (subscription mode).
 * - No Stripe keys     -> MOCK BILLING MODE: switch to PRO immediately.
 */
export async function upgradeToPro(account: SessionUser['account']): Promise<UpgradeResult> {
  if (account.plan === 'PRO') throw ApiError.conflict('This workspace is already on the PRO plan.');

  if (!isStripeConfigured()) {
    await db.account.update({
      where: { id: account.id },
      data: { plan: 'PRO', subscriptionStatus: 'active (demo)' },
    });
    return { demo: true };
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    throw ApiError.badRequest('STRIPE_PRO_PRICE_ID is not set. Add your Stripe test price ID or remove STRIPE_SECRET_KEY to use demo billing.');
  }

  const session = await stripeRequest('/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl()}/billing?checkout=success`,
    cancel_url: `${appUrl()}/billing?checkout=canceled`,
    client_reference_id: account.id,
    'metadata[accountId]': account.id,
    'subscription_data[metadata][accountId]': account.id,
  });
  return { demo: false, url: session.url as string };
}

/** OWNER opens the Stripe customer portal to manage cards/cancel. */
export async function createPortalSession(account: SessionUser['account']) {
  if (!isStripeConfigured()) {
    throw ApiError.badRequest('Stripe is not configured — the billing portal is unavailable in demo billing mode.');
  }
  if (!account.stripeCustomerId) {
    throw ApiError.badRequest('This workspace has no Stripe customer yet. Upgrade to Pro first.');
  }
  const session = await stripeRequest('/billing_portal/sessions', {
    customer: account.stripeCustomerId,
    return_url: `${appUrl()}/billing`,
  });
  return { url: session.url as string };
}

function findAccountWhere(object: Record<string, unknown>) {
  const subscriptionId = typeof object.id === 'string' ? object.id : undefined;
  const customerId = typeof object.customer === 'string' ? object.customer : undefined;
  return {
    OR: [
      ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
      ...(customerId ? [{ stripeCustomerId: customerId }] : []),
    ],
  };
}

/**
 * Apply a verified Stripe webhook event.
 * Handles: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted.
 */
export async function applyStripeEvent(event: StripeEvent): Promise<string> {
  const object = event.data?.object ?? {};
  const metadata = (object.metadata as Record<string, string> | undefined) ?? {};

  switch (event.type) {
    case 'checkout.session.completed': {
      const accountId = object.client_reference_id || metadata.accountId;
      if (typeof accountId !== 'string') return 'ignored: no accountId in session';
      const account = await db.account.findUnique({ where: { id: accountId } });
      if (!account) return 'ignored: unknown account';
      await db.account.update({
        where: { id: account.id },
        data: {
          plan: 'PRO',
          stripeCustomerId: typeof object.customer === 'string' ? object.customer : account.stripeCustomerId,
          stripeSubscriptionId: typeof object.subscription === 'string' ? object.subscription : account.stripeSubscriptionId,
          subscriptionStatus: 'active',
        },
      });
      return 'workspace upgraded to PRO';
    }

    case 'customer.subscription.updated': {
      const account = await db.account.findFirst({ where: findAccountWhere(object) });
      if (!account) return 'ignored: unknown subscription';
      const status = typeof object.status === 'string' ? object.status : 'active';
      const active = status === 'active' || status === 'trialing';
      await db.account.update({
        where: { id: account.id },
        data: {
          plan: active ? 'PRO' : 'FREE',
          subscriptionStatus: status,
          stripeCustomerId: typeof object.customer === 'string' ? object.customer : account.stripeCustomerId,
          stripeSubscriptionId: typeof object.id === 'string' ? object.id : account.stripeSubscriptionId,
        },
      });
      return `subscription ${status} -> plan ${active ? 'PRO' : 'FREE'}`;
    }

    case 'customer.subscription.deleted': {
      const account = await db.account.findFirst({ where: findAccountWhere(object) });
      if (!account) return 'ignored: unknown subscription';
      await db.account.update({
        where: { id: account.id },
        data: { plan: 'FREE', subscriptionStatus: 'canceled' },
      });
      return 'subscription canceled -> plan FREE';
    }

    default:
      return `ignored: ${event.type}`;
  }
}
