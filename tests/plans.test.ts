import { describe, expect, it } from 'vitest';
import {
  checkClientLimit,
  checkInvoiceLimit,
  isPro,
  startOfUtcMonth,
  startOfUtcMonthOffset,
} from '@/server/services/plans';

describe('checkClientLimit', () => {
  it('allows up to 5 active clients on FREE', () => {
    expect(checkClientLimit('FREE', 0).allowed).toBe(true);
    expect(checkClientLimit('FREE', 4).allowed).toBe(true);
  });

  it('blocks the 6th active client on FREE with an upgrade message', () => {
    const result = checkClientLimit('FREE', 5);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('5 active clients');
      expect(result.reason).toContain('PRO');
    }
  });

  it('PRO has no client limit', () => {
    expect(checkClientLimit('PRO', 0).allowed).toBe(true);
    expect(checkClientLimit('PRO', 10_000).allowed).toBe(true);
  });
});

describe('checkInvoiceLimit', () => {
  it('allows up to 10 invoices per calendar month on FREE', () => {
    expect(checkInvoiceLimit('FREE', 0).allowed).toBe(true);
    expect(checkInvoiceLimit('FREE', 9).allowed).toBe(true);
  });

  it('blocks the 11th invoice of the month on FREE with an upgrade message', () => {
    const result = checkInvoiceLimit('FREE', 10);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('10 invoices per calendar month');
      expect(result.reason).toContain('PRO');
    }
  });

  it('PRO has no invoice limit', () => {
    expect(checkInvoiceLimit('PRO', 500).allowed).toBe(true);
  });
});

describe('helpers', () => {
  it('isPro', () => {
    expect(isPro('PRO')).toBe(true);
    expect(isPro('FREE')).toBe(false);
    expect(isPro('pro')).toBe(false); // plan strings are case-sensitive by contract
  });

  it('startOfUtcMonth truncates to the first day of the month in UTC', () => {
    expect(startOfUtcMonth(new Date('2025-03-15T10:30:00Z')).toISOString()).toBe(
      '2025-03-01T00:00:00.000Z'
    );
    expect(startOfUtcMonth(new Date('2025-12-31T23:59:59Z')).toISOString()).toBe(
      '2025-12-01T00:00:00.000Z'
    );
  });

  it('startOfUtcMonthOffset crosses year boundaries correctly', () => {
    // 5 months back from March 2025 -> October 2024
    expect(startOfUtcMonthOffset(new Date('2025-03-15T00:00:00Z'), 5).toISOString()).toBe(
      '2024-10-01T00:00:00.000Z'
    );
    expect(startOfUtcMonthOffset(new Date('2025-03-15T00:00:00Z'), 0).toISOString()).toBe(
      '2025-03-01T00:00:00.000Z'
    );
  });
});
