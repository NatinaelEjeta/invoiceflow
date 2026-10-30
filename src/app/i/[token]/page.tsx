'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileWarning, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/invoice/status-badge';
import { InvoicePdfButton } from '@/components/invoice/invoice-pdf-button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { InvoiceDto, PublicInvoiceDto } from '@/lib/types';

/**
 * Public, token-based invoice page. No login required — anyone with the
 * share link can view the invoice and download/print it.
 */
export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const query = useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () => api<PublicInvoiceDto>(`/api/public/invoices/${token}`),
    enabled: token.length > 0,
    retry: false,
  });

  const invoice = query.data?.invoice;
  const workspace = query.data?.workspace;

  const balanceCents = useMemo(
    () => Math.max(0, (invoice?.totalCents ?? 0) - (invoice?.paidCents ?? 0)),
    [invoice?.totalCents, invoice?.paidCents]
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (query.isPending) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <header className="border-b bg-card">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-36" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <Card aria-busy="true" aria-live="polite">
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-40" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="ml-auto w-full max-w-xs space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="mt-auto px-4 pb-6 pt-2">
          <p className="text-center text-sm text-muted-foreground">
            Powered by{' '}
            <Link
              href="/"
              aria-label="InvoiceFlow home"
              className="font-medium underline-offset-4 hover:underline"
            >
              InvoiceFlow
            </Link>
          </p>
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state (invalid token / invoice no longer shared)
  // -------------------------------------------------------------------------

  if (query.isError || !invoice || !workspace) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <main className="grid flex-1 place-items-center px-4 py-10">
          <Card className="w-full max-w-md text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                aria-hidden="true"
              >
                <FileWarning className="h-6 w-6 text-muted-foreground" />
              </span>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">Invoice not found</h1>
                <p className="text-sm text-muted-foreground">
                  This link is invalid or the invoice is no longer shared.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="mt-auto px-4 pb-6 pt-2">
          <p className="text-center text-sm text-muted-foreground">
            Powered by{' '}
            <Link
              href="/"
              aria-label="InvoiceFlow home"
              className="font-medium underline-offset-4 hover:underline"
            >
              InvoiceFlow
            </Link>
          </p>
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loaded invoice document
  // -------------------------------------------------------------------------

  const client = invoice.client;
  const discountLabel =
    invoice.discountType === 'PERCENT'
      ? `Discount (${invoice.discountValue}%)`
      : 'Discount';

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            aria-hidden="true"
          >
            {(workspace.logoText || workspace.name).slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate font-semibold">{workspace.name}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="sr-only">{`Invoice ${invoice.number} from ${workspace.name}`}</h1>
        <Card>
          <CardContent className="space-y-6">
            {/* Title row */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Invoice
                </p>
                <p className="text-2xl font-bold">{invoice.number}</p>
              </div>
              <StatusBadge status={invoice.status} />
            </div>

            {/* Bill to + meta */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="min-w-0">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Bill to
                </h2>
                <div className="mt-2 space-y-0.5 text-sm">
                  <p className="font-medium">{client.name}</p>
                  {client.company && (
                    <p className="text-muted-foreground">{client.company}</p>
                  )}
                  {client.address && (
                    <p className="whitespace-pre-line text-muted-foreground">
                      {client.address}
                    </p>
                  )}
                  {client.email && <p>{client.email}</p>}
                  {client.taxNumber && (
                    <p className="text-muted-foreground">
                      Tax ID: {client.taxNumber}
                    </p>
                  )}
                </div>
              </div>

              <dl className="grid w-full max-w-xs gap-1.5 text-sm sm:justify-self-end">
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">Issue date</dt>
                  <dd className="font-medium">{formatDate(invoice.issueDate)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">Due date</dt>
                  <dd className="font-medium">{formatDate(invoice.dueDate)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">Currency</dt>
                  <dd className="font-medium">{invoice.currency}</dd>
                </div>
              </dl>
            </div>

            <Separator />

            {/* Line items */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-normal">
                        {item.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.unitPriceCents, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(
                          Math.round(item.quantity * item.unitPriceCents),
                          invoice.currency
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <dl className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatMoney(invoice.subtotalCents, invoice.currency)}
                </dd>
              </div>

              {invoice.discountType !== 'NONE' && (
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">{discountLabel}</dt>
                  <dd className="tabular-nums">
                    -{formatMoney(invoice.discountCents, invoice.currency)}
                  </dd>
                </div>
              )}

              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Tax ({invoice.taxRate}%)</dt>
                <dd className="tabular-nums">
                  {formatMoney(invoice.taxCents, invoice.currency)}
                </dd>
              </div>

              <div className="flex justify-between gap-6 border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatMoney(invoice.totalCents, invoice.currency)}
                </dd>
              </div>

              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="tabular-nums">
                  -{formatMoney(invoice.paidCents, invoice.currency)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-6 pt-2">
                <dt className="text-base font-bold">Balance due</dt>
                <dd className="rounded-md bg-muted px-2 py-1 text-lg font-bold tabular-nums">
                  {formatMoney(balanceCents, invoice.currency)}
                </dd>
              </div>
            </dl>

            {/* Notes */}
            {invoice.notes && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Notes
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm">
                  {invoice.notes}
                </p>
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <InvoicePdfButton
                invoice={{ ...invoice, payments: [], accountId: '' } as InvoiceDto}
                workspace={workspace}
                variant="default"
                size="default"
                label="Download PDF"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                aria-label="Print invoice"
              >
                <Printer aria-hidden="true" />
                Print
              </Button>
            </div>

            {workspace.footerNote && (
              <p className="text-center text-xs italic text-muted-foreground">
                {workspace.footerNote}
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="mt-auto px-4 pb-6 pt-2">
        <p className="text-center text-sm text-muted-foreground">
          Powered by{' '}
          <Link
            href="/"
            aria-label="InvoiceFlow home"
            className="font-medium underline-offset-4 hover:underline"
          >
            InvoiceFlow
          </Link>
        </p>
      </footer>
    </div>
  );
}
