/**
 * Invoice status machine — pure rules, unit-tested.
 *
 *   DRAFT  -> SENT | VOID
 *   SENT   -> PAID | OVERDUE | VOID      (PAID via payments reaching the balance)
 *   OVERDUE-> PAID | VOID
 *   PAID   -> (terminal)
 *   VOID   -> (terminal)
 *
 * Notes:
 *  - PAID is terminal: money has been collected; it can never go back to DRAFT.
 *  - OVERDUE is set automatically by the daily cron endpoint
 *    (POST /api/cron/overdue) for past-due SENT invoices; it can also be set
 *    manually, so it is part of the map.
 *  - Recording a payment that clears the balance moves SENT/OVERDUE -> PAID.
 */

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

export const ALL_INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'];

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['SENT', 'VOID'],
  SENT: ['PAID', 'OVERDUE', 'VOID'],
  PAID: [],
  OVERDUE: ['PAID', 'VOID'],
  VOID: [],
};

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (ALL_INVOICE_STATUSES as string[]).includes(value);
}

export function canTransition(from: string, to: string): boolean {
  if (!isInvoiceStatus(from) || !isInvoiceStatus(to)) return false;
  return INVOICE_TRANSITIONS[from].includes(to);
}
