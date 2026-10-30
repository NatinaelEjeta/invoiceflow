import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  balanceCents,
  computeTotals,
  formatInvoiceNumber,
  roundHalfUpCents,
  toCents,
} from '@/server/services/money';

// ---------------------------------------------------------------------------
// toCents — decimal money -> integer cents with half-up rounding
// ---------------------------------------------------------------------------

describe('toCents', () => {
  it('converts common money amounts', () => {
    expect(toCents('10')).toBe(1000);
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('0.1')).toBe(10);
    expect(toCents(85)).toBe(8500);
    expect(toCents(0)).toBe(0);
  });

  it('rounds half-up at the third decimal', () => {
    expect(toCents('12.345')).toBe(1235); // 1234.5 -> 1235
    expect(toCents('12.344')).toBe(1234);
    expect(toCents('0.005')).toBe(1); // 0.5 cents -> 1
    expect(toCents('0.004')).toBe(0);
  });

  it('is immune to binary float drift', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in JS floats
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.1)).toBe(110);
    expect(toCents(2.675)).toBe(268); // String() path: "2.675" -> 267.5 -> 268
  });

  it('handles junk and empty input defensively', () => {
    expect(toCents('')).toBe(0);
    expect(toCents('abc')).toBe(0);
    expect(toCents('12,34')).toBe(0); // no thousand separators supported
    expect(toCents(Number.NaN)).toBe(0);
  });

  it('supports negative amounts', () => {
    expect(toCents('-1.25')).toBe(-125);
  });
});

describe('roundHalfUpCents', () => {
  it('rounds halves away from zero', () => {
    expect(roundHalfUpCents(0.5)).toBe(1);
    expect(roundHalfUpCents(1.5)).toBe(2);
    expect(roundHalfUpCents(2.5)).toBe(3);
    expect(roundHalfUpCents(-0.5)).toBe(-1);
    expect(roundHalfUpCents(52.5)).toBe(53);
  });
});

// ---------------------------------------------------------------------------
// computeTotals — subtotal, discount, tax, total with integer-cent rounding
// ---------------------------------------------------------------------------

describe('computeTotals', () => {
  it('computes a plain invoice with tax', () => {
    const totals = computeTotals({
      items: [{ quantity: 2, unitPriceCents: 1050 }],
      taxRate: 8.25,
      discountType: 'NONE',
      discountValue: 0,
    });
    // subtotal 2100, tax 2100 * 0.0825 = 173.25 -> 173
    expect(totals).toEqual({ subtotalCents: 2100, discountCents: 0, taxCents: 173, totalCents: 2273 });
  });

  it('rounds each line item independently so lines sum to the subtotal', () => {
    const totals = computeTotals({
      items: [
        { quantity: 3, unitPriceCents: 333 }, // 9.99 -> 999
        { quantity: 1, unitPriceCents: 1050 }, // 10.50 -> 1050
      ],
      taxRate: 0,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(totals.subtotalCents).toBe(999 + 1050);
    expect(totals.totalCents).toBe(totals.subtotalCents);
  });

  it('applies tax after a PERCENT discount', () => {
    const totals = computeTotals({
      items: [{ quantity: 1, unitPriceCents: 10000 }], // $100.00
      taxRate: 20,
      discountType: 'PERCENT',
      discountValue: 10, // -$10.00
    });
    expect(totals.subtotalCents).toBe(10000);
    expect(totals.discountCents).toBe(1000);
    expect(totals.taxCents).toBe(1800); // 20% of 9000
    expect(totals.totalCents).toBe(10800);
  });

  it('applies a FIXED discount given in major units', () => {
    const totals = computeTotals({
      items: [{ quantity: 1, unitPriceCents: 10000 }],
      taxRate: 0,
      discountType: 'FIXED',
      discountValue: 25.505, // -> 2551 cents (half-up)
    });
    expect(totals.discountCents).toBe(2551);
    expect(totals.totalCents).toBe(7449);
  });

  it('never discounts below zero', () => {
    const totals = computeTotals({
      items: [{ quantity: 1, unitPriceCents: 100 }], // $1.00
      taxRate: 0,
      discountType: 'FIXED',
      discountValue: 500, // way more than the subtotal
    });
    expect(totals.discountCents).toBe(100);
    expect(totals.totalCents).toBe(0);
  });

  it('clamps percent discounts above 100%', () => {
    const totals = computeTotals({
      items: [{ quantity: 1, unitPriceCents: 5000 }],
      taxRate: 0,
      discountType: 'PERCENT',
      discountValue: 150,
    });
    expect(totals.discountCents).toBe(5000);
    expect(totals.totalCents).toBe(0);
  });

  it('rounds tax half-up: 5% of 1050 cents = 52.5 -> 53', () => {
    const totals = computeTotals({
      items: [{ quantity: 1, unitPriceCents: 1050 }],
      taxRate: 5,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(totals.taxCents).toBe(53);
    expect(totals.totalCents).toBe(1103);
  });

  it('handles fractional quantities', () => {
    const totals = computeTotals({
      items: [{ quantity: 2.5, unitPriceCents: 2000 }], // 5000 exactly
      taxRate: 10,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(totals.subtotalCents).toBe(5000);
    expect(totals.taxCents).toBe(500);
    expect(totals.totalCents).toBe(5500);
  });

  it('returns zeros for an empty invoice', () => {
    const totals = computeTotals({ items: [], taxRate: 10, discountType: 'NONE', discountValue: 0 });
    expect(totals).toEqual({ subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe('helpers', () => {
  it('balanceCents never goes below zero', () => {
    expect(balanceCents(1000, 400)).toBe(600);
    expect(balanceCents(1000, 1000)).toBe(0);
    expect(balanceCents(1000, 1200)).toBe(0);
  });

  it('formatInvoiceNumber pads to at least 4 digits', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-0001');
    expect(formatInvoiceNumber(42)).toBe('INV-0042');
    expect(formatInvoiceNumber(999)).toBe('INV-0999');
    expect(formatInvoiceNumber(12345)).toBe('INV-12345');
  });
});
