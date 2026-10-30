import { describe, expect, it } from 'vitest';
import { signStripePayload, verifyStripeSignature } from '@/server/services/stripe-signature';

const SECRET = 'whsec_test_0123456789abcdef';
const PAYLOAD = JSON.stringify({
  id: 'evt_123',
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_123', client_reference_id: 'account_1' } },
});

describe('Stripe webhook signature verification', () => {
  it('accepts a valid signature and parses the event', () => {
    const header = signStripePayload(PAYLOAD, SECRET, Math.floor(Date.now() / 1000));
    const result = verifyStripeSignature(PAYLOAD, header, SECRET);
    expect(result.valid).toBe(true);
    expect(result.event?.type).toBe('checkout.session.completed');
    expect(result.event?.data.object.client_reference_id).toBe('account_1');
  });

  it('rejects a signature made with the wrong secret', () => {
    const header = signStripePayload(PAYLOAD, 'whsec_wrong', Math.floor(Date.now() / 1000));
    const result = verifyStripeSignature(PAYLOAD, header, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mismatch');
  });

  it('rejects a tampered payload', () => {
    const header = signStripePayload(PAYLOAD, SECRET, Math.floor(Date.now() / 1000));
    const tampered = PAYLOAD.replace('account_1', 'account_EVIL');
    const result = verifyStripeSignature(tampered, header, SECRET);
    expect(result.valid).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(verifyStripeSignature(PAYLOAD, null, SECRET).valid).toBe(false);
    expect(verifyStripeSignature(PAYLOAD, undefined, SECRET).valid).toBe(false);
    expect(verifyStripeSignature(PAYLOAD, 't=123', SECRET).valid).toBe(false); // no v1
    expect(verifyStripeSignature(PAYLOAD, 'v1=abc', SECRET).valid).toBe(false); // no t
    expect(verifyStripeSignature(PAYLOAD, 'garbage', SECRET).valid).toBe(false);
  });

  it('rejects timestamps outside the tolerance window (replay protection)', () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const header = signStripePayload(PAYLOAD, SECRET, tenMinutesAgo);
    expect(verifyStripeSignature(PAYLOAD, header, SECRET).valid).toBe(false); // default 300s
    // A larger tolerance accepts it (useful for tests/backfills).
    expect(verifyStripeSignature(PAYLOAD, header, SECRET, 3600).valid).toBe(true);
  });

  it('accepts any of multiple v1 signatures (Stripe rotation)', () => {
    const now = Math.floor(Date.now() / 1000);
    const header = `t=${now},v1=deadbeef,v1=${signStripePayload(PAYLOAD, SECRET, now).split('v1=')[1]}`;
    const result = verifyStripeSignature(PAYLOAD, header, SECRET);
    expect(result.valid).toBe(true);
  });

  it('rejects non-JSON payloads', () => {
    const body = 'not-json';
    const header = signStripePayload(body, SECRET, Math.floor(Date.now() / 1000));
    const result = verifyStripeSignature(body, header, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('JSON');
  });
});
