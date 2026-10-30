import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stripe webhook signature verification — written with plain node:crypto,
 * no Stripe SDK required.
 *
 * Stripe signs each delivery with HMAC-SHA256 over the string
 *   `${timestamp}.${rawBody}`
 * and sends a `Stripe-Signature` header like:
 *   t=1614556800,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
 *
 * We verify with a timing-safe comparison and reject timestamps older than
 * `toleranceSeconds` (Stripe recommends 5 minutes) to mitigate replay attacks.
 */

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface SignatureVerification {
  valid: boolean;
  reason?: string;
  event?: StripeEvent;
}

export function signStripePayload(payload: string, secret: string, timestampSeconds: number): string {
  const mac = createHmac('sha256', secret).update(`${timestampSeconds}.${payload}`).digest('hex');
  return `t=${timestampSeconds},v1=${mac}`;
}

export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds = 300
): SignatureVerification {
  if (!header) return { valid: false, reason: 'Missing Stripe-Signature header.' };

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, ...rest] = part.trim().split('=');
    const value = rest.join('=');
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) {
    return { valid: false, reason: 'Malformed Stripe-Signature header.' };
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const matches = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8');
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
  if (!matches) return { valid: false, reason: 'Signature mismatch.' };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    return { valid: false, reason: 'Timestamp outside the allowed tolerance.' };
  }

  try {
    return { valid: true, event: JSON.parse(payload) as StripeEvent };
  } catch {
    return { valid: false, reason: 'Payload is not valid JSON.' };
  }
}
