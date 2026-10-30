import { NextResponse, type NextRequest } from 'next/server';
import { ApiError } from '@/server/errors';
import { getSessionUser, requireRole } from '@/server/middleware/auth';
import {
  applyStripeEvent,
  createPortalSession,
  upgradeToPro,
} from '@/server/services/billing.service';
import { getBillingInfo } from '@/server/services/dashboard.service';
import { verifyStripeSignature } from '@/server/services/stripe-signature';

/** Plan + usage — any signed-in user can view; members see it read-only. */
export async function info(req: NextRequest) {
  const user = await getSessionUser(req);
  const billing = await getBillingInfo(user.account);
  return NextResponse.json(billing);
}

/** Upgrade: Stripe Checkout when configured, instant demo billing otherwise. */
export async function checkout(req: NextRequest) {
  const user = await getSessionUser(req);
  requireRole(user, ['OWNER'], 'upgrade the workspace plan');
  const result = await upgradeToPro(user.account);
  return NextResponse.json(result, { status: 201 });
}

/** Stripe customer portal (OWNER only). */
export async function portal(req: NextRequest) {
  const user = await getSessionUser(req);
  requireRole(user, ['OWNER'], 'manage billing');
  const result = await createPortalSession(user.account);
  return NextResponse.json(result, { status: 201 });
}

/**
 * Stripe webhook. Signature is the authentication: the raw body is verified
 * with HMAC-SHA256 + timing-safe comparison before anything is applied.
 * Handles checkout.session.completed, customer.subscription.updated and
 * customer.subscription.deleted.
 */
export async function webhook(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw ApiError.badRequest('STRIPE_WEBHOOK_SECRET is not configured.');

  const verification = verifyStripeSignature(payload, signature, secret);
  if (!verification.valid || !verification.event) {
    throw ApiError.badRequest(`Webhook verification failed: ${verification.reason}`);
  }

  const handled = await applyStripeEvent(verification.event);
  return NextResponse.json({ received: true, handled });
}
