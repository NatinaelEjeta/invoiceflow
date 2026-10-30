import { describe, expect, it } from 'vitest';
import { ALL_INVOICE_STATUSES, INVOICE_TRANSITIONS, canTransition } from '@/server/services/status';

describe('invoice status machine', () => {
  it('allows the documented transitions', () => {
    expect(canTransition('DRAFT', 'SENT')).toBe(true);
    expect(canTransition('DRAFT', 'VOID')).toBe(true);
    expect(canTransition('SENT', 'PAID')).toBe(true);
    expect(canTransition('SENT', 'OVERDUE')).toBe(true);
    expect(canTransition('SENT', 'VOID')).toBe(true);
    expect(canTransition('OVERDUE', 'PAID')).toBe(true);
    expect(canTransition('OVERDUE', 'VOID')).toBe(true);
  });

  it('forbids everything else, especially PAID going back to DRAFT', () => {
    expect(canTransition('PAID', 'DRAFT')).toBe(false);
    expect(canTransition('PAID', 'SENT')).toBe(false);
    expect(canTransition('PAID', 'OVERDUE')).toBe(false);
    expect(canTransition('PAID', 'VOID')).toBe(false);
    expect(canTransition('VOID', 'DRAFT')).toBe(false);
    expect(canTransition('VOID', 'SENT')).toBe(false);
    expect(canTransition('DRAFT', 'PAID')).toBe(false); // PAID only via payments
    expect(canTransition('DRAFT', 'OVERDUE')).toBe(false);
    expect(canTransition('OVERDUE', 'DRAFT')).toBe(false);
    expect(canTransition('OVERDUE', 'SENT')).toBe(false);
  });

  it('treats unknown statuses as non-transitionable', () => {
    expect(canTransition('WEIRD', 'SENT')).toBe(false);
    expect(canTransition('SENT', 'WEIRD')).toBe(false);
    expect(canTransition('', 'SENT')).toBe(false);
  });

  it('every status has an entry in the transition map', () => {
    for (const status of ALL_INVOICE_STATUSES) {
      expect(Array.isArray(INVOICE_TRANSITIONS[status])).toBe(true);
    }
  });
});
