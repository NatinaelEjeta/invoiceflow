'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  ExternalLink,
  FileText,
  FileX,
  HandCoins,
  Link2,
  Mail,
  Pencil,
  Send,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { InvoiceDetailDto, InvoiceDto, PaymentMethod } from '@/lib/types';
import { balanceCents, formatMoney, roundHalfUpCents } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/dates';
import { PAYMENT_METHODS } from '@/lib/constants';
import { StatusBadge } from '@/components/invoice/status-badge';
import { InvoicePdfButton } from '@/components/invoice/invoice-pdf-button';
import { PaymentDialog } from '@/components/invoice/payment-dialog';
import { EmptyState } from '@/components/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface SendEmailResponse {
  invoice: InvoiceDto;
  email: { provider: 'console' | 'resend'; delivered: boolean };
}

function methodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((option) => option.value === method)?.label ?? method;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<InvoiceDetailDto>(`/api/invoices/${id}`),
    enabled: Boolean(id),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  const statusMutation = useMutation({
    mutationFn: (status: 'SENT' | 'VOID') =>
      api<{ invoice: InvoiceDto }>(`/api/invoices/${id}/status`, {
        method: 'POST',
        body: { status },
      }),
    onSuccess: (data) => {
      toast.success(
        data.invoice.status === 'VOID'
          ? `${data.invoice.number} voided.`
          : `${data.invoice.number} marked as sent.`
      );
      invalidateAll();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not update the invoice.');
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => api<SendEmailResponse>(`/api/invoices/${id}/send`, { method: 'POST' }),
    onSuccess: (data) => {
      if (data.email.provider === 'console') {
        toast.info('Email logged to the server console (no RESEND_API_KEY set).');
      } else {
        toast.success(
          `Invoice emailed to ${data.invoice.client.email ?? data.invoice.client.name}.`
        );
      }
      invalidateAll();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not send the email.');
    },
  });

  async function copyPublicLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/i/${token}`);
      toast.success('Public link copied to clipboard.');
    } catch {
      toast.error('Could not copy the link.');
    }
  }

  // --- Loading -----------------------------------------------------------------
  if (detailQuery.isPending || !detailQuery.data) {
    if (detailQuery.isError) {
      const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
      return (
        <div className="mx-auto w-full max-w-6xl py-8">
          <EmptyState
            icon={notFound ? FileX : FileText}
            title={notFound ? 'Invoice not found' : "Couldn't load invoice"}
            description={
              detailQuery.error instanceof Error
                ? detailQuery.error.message
                : 'Something went wrong. Please try again.'
            }
            action={{ label: 'Back to invoices', onClick: () => router.push('/invoices') }}
          />
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-6xl space-y-6" aria-busy="true" aria-label="Loading invoice">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="grid gap-4 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="grid gap-4">
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const { invoice, workspace } = detailQuery.data;
  const balance = balanceCents(invoice.totalCents, invoice.paidCents);
  const publicPath = `/i/${invoice.publicToken}`;
  const taxLabel = String(Number(invoice.taxRate));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <header className="space-y-4">
        <div>
          <Link
            href="/invoices"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Invoices
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{invoice.number}</h1>
          <StatusBadge status={invoice.status} />
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:size-9"
            aria-label="Copy public link"
            onClick={() => copyPublicLink(invoice.publicToken)}
          >
            <Link2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        {/* Actions by status */}
        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === 'DRAFT' ? (
            <>
              <Button
                className="h-11 sm:h-9"
                onClick={() => statusMutation.mutate('SENT')}
                disabled={statusMutation.isPending}
              >
                <Send className="h-4 w-4" aria-hidden />
                Mark as sent
              </Button>
              <Button asChild variant="outline" className="h-11 sm:h-9">
                <Link href={`/invoices/${invoice.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Link>
              </Button>
              <Button
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                <Mail className="h-4 w-4" aria-hidden />
                {sendMutation.isPending ? 'Sending…' : 'Send by email'}
              </Button>
              <VoidAction
                pending={statusMutation.isPending}
                onConfirm={() => statusMutation.mutate('VOID')}
              />
            </>
          ) : null}

          {invoice.status === 'SENT' || invoice.status === 'OVERDUE' ? (
            <>
              <Button className="h-11 sm:h-9" onClick={() => setPayOpen(true)}>
                <HandCoins className="h-4 w-4" aria-hidden />
                Record payment
              </Button>
              <Button
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                <Mail className="h-4 w-4" aria-hidden />
                {sendMutation.isPending ? 'Sending…' : 'Send by email'}
              </Button>
              <VoidAction
                pending={statusMutation.isPending}
                onConfirm={() => statusMutation.mutate('VOID')}
              />
            </>
          ) : null}

          {invoice.status === 'PAID' ? (
            <p className="text-sm text-muted-foreground">This invoice is fully paid.</p>
          ) : null}
          {invoice.status === 'VOID' ? (
            <p className="text-sm text-muted-foreground">This invoice is void.</p>
          ) : null}

          <InvoicePdfButton invoice={invoice} workspace={workspace} className="h-11 sm:h-8" />
        </div>
      </header>

      {/* Content grid */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bill to</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-semibold">{invoice.client.name}</p>
              {invoice.client.company ? (
                <p className="text-muted-foreground">{invoice.client.company}</p>
              ) : null}
              {invoice.client.address ? (
                <p className="whitespace-pre-line text-muted-foreground">{invoice.client.address}</p>
              ) : null}
              {invoice.client.email ? (
                <p className="text-muted-foreground">{invoice.client.email}</p>
              ) : null}
              {invoice.client.taxNumber ? (
                <p className="text-muted-foreground">Tax ID: {invoice.client.taxNumber}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...invoice.items]
                    .sort((a, b) => a.position - b.position)
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(item.unitPriceCents, invoice.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(roundHalfUpCents(item.quantity * item.unitPriceCents), invoice.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {invoice.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{invoice.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right column */}
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatMoney(invoice.subtotalCents, invoice.currency)}</span>
              </div>
              {invoice.discountCents > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {invoice.discountType === 'PERCENT'
                      ? `Discount (${String(Number(invoice.discountValue))}%)`
                      : 'Discount'}
                  </span>
                  <span className="tabular-nums">
                    -{formatMoney(invoice.discountCents, invoice.currency)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Tax ({taxLabel}%)</span>
                <span className="tabular-nums">{formatMoney(invoice.taxCents, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(invoice.totalCents, invoice.currency)}</span>
              </div>
              {invoice.paidCents > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="tabular-nums">{formatMoney(invoice.paidCents, invoice.currency)}</span>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-4 rounded-lg bg-muted p-3">
                <span className="font-medium">Balance due</span>
                <span className="text-lg font-bold tabular-nums">
                  {formatMoney(balance, invoice.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Issue date</span>
                <span className="font-medium">{formatDate(invoice.issueDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Due date</span>
                <span className="font-medium">{formatDate(invoice.dueDate)}</span>
              </div>
              {invoice.sentAt ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Sent date</span>
                  <span className="font-medium">{formatDateTime(invoice.sentAt)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium">{invoice.currency}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatDateTime(invoice.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {[...invoice.payments]
                    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt))
                    .map((payment) => (
                      <li key={payment.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold tabular-nums">
                            {formatMoney(payment.amountCents, invoice.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(payment.paidAt)} · {methodLabel(payment.method)}
                          </p>
                          {payment.note ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {payment.note}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Public link</CardTitle>
              <CardDescription>
                Anyone with this link can view the invoice — no account needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">{publicPath}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="h-11 flex-1 sm:h-9"
                  onClick={() => copyPublicLink(invoice.publicToken)}
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  Copy link
                </Button>
                <Button asChild variant="outline" className="h-11 flex-1 sm:h-9">
                  <a
                    href={`${typeof window !== 'undefined' ? window.location.origin : ''}${publicPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentDialog invoice={invoice} open={payOpen} onOpenChange={setPayOpen} />
    </div>
  );
}

function VoidAction({ pending, onConfirm }: { pending: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9"
          disabled={pending}
        >
          <Ban className="h-4 w-4" aria-hidden />
          Void
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            Voided invoices are final and cannot be reopened.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Void invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
