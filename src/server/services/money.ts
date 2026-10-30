/**
 * ============================================================================
 * MONEY & TOTALS — the single source of truth for all invoice arithmetic.
 * ============================================================================
 *
 * Rules used everywhere in InvoiceFlow:
 *
 *  1. Money is ALWAYS stored and transported as integer cents (e.g. 1999 = $19.99).
 *  2. Quantities, tax rates and percent discounts are floats/decimals.
 *  3. Every intermediate value that becomes a stored amount is rounded ONCE,
 *     half-up (0.5 rounds away from zero), to the nearest cent.
 *  4. Line items are rounded individually so the PDF line amounts always add
 *     up to the subtotal.
 *  5. Discount is applied first; tax is charged on (subtotal - discount).
 *  6. All arithmetic uses integer cents and one multiplication per rounding
 *     step, which avoids binary floating-point drift (0.1 + 0.2 problems).
 *
 * This module is PURE (no I/O, no framework imports) so it is trivially
 * unit-testable and safe to import from both server and client code.
 */

export type DiscountType = 'NONE' | 'PERCENT' | 'FIXED';

/**
 * Round a float to the nearest integer cent, halves away from zero.
 * Math.round(-0.5) === 0 (rounds towards +Infinity), so negative values are
 * negated first to keep "half-up" symmetric. Money inputs here are never
 * negative, but the helper is defensive anyway.
 */
export function roundHalfUpCents(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Parse a decimal money amount in MAJOR units (e.g. 12.345 or "12.345")
 * into integer cents with half-up rounding, without float drift.
 *
 * Implementation works on the string representation:
 *   "12.345" -> whole "12", fraction "345" -> 345/1000 dollars = 34.5 cents
 *             -> roundHalfUp(34.5) = 35 -> 1235 cents ($12.35)
 */
export function toCents(amount: number | string): number {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return 0;
    amount = String(amount);
  }

  const trimmed = amount.trim().replace(/^\+/, '');
  if (trimmed === '' || !/^-?\d*(\.\d*)?$/.test(trimmed)) return 0;

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart = '', fractionPart = ''] = unsigned.split('.');

  // Whole dollars -> cents (exact integer math, safe for large inputs).
  const wholeCents = wholePart === '' ? 0 : Number(wholePart) * 100;

  // Fractional dollars: keep 3 digits (thousandths) — enough precision to
  // decide the half-up rounding of the 2nd decimal digit.
  const frac = (fractionPart + '000').slice(0, 3);
  const fracCents = Number(frac) / 10; // e.g. "345" -> 34.5 cents

  const cents = wholeCents + roundHalfUpCents(fracCents);
  return negative ? -cents : cents;
}

/** Convert integer cents back to a float in major units (for transport/UI). */
export function centsToAmount(cents: number): number {
  return cents / 100;
}

/** A single invoice line item, in the shape stored on the server. */
export interface TotalsLine {
  quantity: number;
  unitPriceCents: number;
}

export interface TotalsResult {
  /** Sum of rounded line amounts, before discount and tax. */
  subtotalCents: number;
  /** Absolute discount amount in cents (never negative, never above subtotal). */
  discountCents: number;
  /** Tax charged on (subtotal - discount). */
  taxCents: number;
  /** The final amount the client owes: subtotal - discount + tax. */
  totalCents: number;
}

export interface ComputeTotalsParams {
  items: TotalsLine[];
  /** Tax rate in percent, 0-100. */
  taxRate: number;
  discountType: DiscountType;
  /**
   * PERCENT: percentage 0-100.
   * FIXED: amount in MAJOR currency units (e.g. 25.5 = $25.50).
   */
  discountValue: number;
}

/**
 * Compute invoice totals with consistent, documented rounding:
 *   1. subtotal = Σ roundHalfUp(quantity × unitPriceCents)  (per-line rounding)
 *   2. discount = PERCENT ? roundHalfUp(subtotal × value / 100)
 *                 : FIXED   ? min(toCents(value), subtotal)
 *                 :           0
 *   3. tax      = roundHalfUp((subtotal - discount) × taxRate / 100)
 *   4. total    = subtotal - discount + tax
 */
export function computeTotals(params: ComputeTotalsParams): TotalsResult {
  const subtotalCents = params.items.reduce((sum, line) => {
    const lineCents = roundHalfUpCents(line.quantity * line.unitPriceCents);
    return sum + lineCents;
  }, 0);

  let discountCents = 0;
  if (params.discountType === 'PERCENT') {
    const rate = Math.min(Math.max(params.discountValue, 0), 100);
    discountCents = roundHalfUpCents((subtotalCents * rate) / 100);
  } else if (params.discountType === 'FIXED') {
    discountCents = Math.min(toCents(params.discountValue), subtotalCents);
  }
  discountCents = Math.max(0, discountCents);

  const taxableCents = subtotalCents - discountCents;
  const taxCents = roundHalfUpCents((taxableCents * Math.max(params.taxRate, 0)) / 100);
  const totalCents = taxableCents + taxCents;

  return { subtotalCents, discountCents, taxCents, totalCents };
}

/** Outstanding balance for an invoice, in cents (never below zero). */
export function balanceCents(totalCents: number, paidCents: number): number {
  return Math.max(0, totalCents - paidCents);
}

/** Format "INV-<n>" with at least 4 digits: 1 -> "INV-0001", 12345 -> "INV-12345". */
export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, '0')}`;
}
