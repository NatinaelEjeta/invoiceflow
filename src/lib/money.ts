/**
 * Client-side money + parsing helpers.
 * All heavy math lives in the pure server module (src/server/services/money.ts);
 * this file re-exports it for client components and adds Intl formatting.
 */
export {
  toCents,
  centsToAmount,
  computeTotals,
  roundHalfUpCents,
  balanceCents,
  formatInvoiceNumber,
  type DiscountType,
  type TotalsResult,
} from '@/server/services/money';

/** Format integer cents for the UI, e.g. 123456 + "USD" -> "$1,234.56". */
export function formatMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format((cents ?? 0) / 100);
  } catch {
    return `${currency} ${((cents ?? 0) / 100).toFixed(2)}`;
  }
}

/** Compact formatting for chart axes: $1.2k, $3.4M. */
export function formatMoneyCompact(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format((cents ?? 0) / 100);
  } catch {
    return `${currency} ${((cents ?? 0) / 100).toFixed(2)}`;
  }
}

/**
 * Plain-code formatting for PDFs (jsPDF standard fonts cannot render every
 * currency glyph): "USD 1,234.56".
 */
export function pdfMoney(cents: number, currency = 'USD'): string {
  const amount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents ?? 0) / 100);
  return `${cents < 0 ? '-' : ''}${currency} ${amount}`;
}
