'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  FileX,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type {
  ClientDto,
  DiscountType,
  InvoiceDetailDto,
  InvoiceDto,
  MeDto,
} from '@/lib/types';
import { computeTotals, formatMoney, roundHalfUpCents, toCents } from '@/lib/money';
import { todayInputValue } from '@/lib/dates';
import { CURRENCIES } from '@/lib/constants';
import { StatusBadge } from '@/components/invoice/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface InvoiceEditorProps {
  mode: 'create' | 'edit';
  invoiceId?: string;
}

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface FormState {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: string;
  discountType: DiscountType;
  discountValue: string;
  notes: string;
  items: ItemRow[];
}

interface SavePayload {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: number;
  discountType: DiscountType;
  discountValue: number;
  notes: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}

const DISCOUNT_TYPES = [
  { value: 'NONE', label: 'No discount' },
  { value: 'PERCENT', label: 'Percent (%)' },
  { value: 'FIXED', label: 'Fixed amount' },
] as const;

/** "YYYY-MM-DD" for today + 14 days (UTC). */
function defaultDueDate(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Build the initial form state once the required data has loaded (null = not ready). */
function buildInitialState(mode: 'create' | 'edit', me: MeDto | undefined, invoice: InvoiceDto | undefined): FormState | null {
  if (mode === 'create') {
    if (!me) return null;
    return {
      clientId: '',
      issueDate: todayInputValue(),
      dueDate: defaultDueDate(),
      currency: me.account.defaultCurrency || 'USD',
      taxRate: String(me.account.defaultTaxRate ?? 0),
      discountType: 'NONE',
      discountValue: '0',
      notes: '',
      items: [{ description: '', quantity: '1', unitPrice: '' }],
    };
  }

  if (!invoice) return null;
  return {
    clientId: invoice.clientId,
    issueDate: invoice.issueDate.slice(0, 10),
    dueDate: invoice.dueDate.slice(0, 10),
    currency: invoice.currency,
    taxRate: String(invoice.taxRate),
    discountType: invoice.discountType,
    discountValue: String(invoice.discountValue),
    notes: invoice.notes ?? '',
    items:
      [...invoice.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: (item.unitPriceCents / 100).toFixed(2),
        })),
  };
}

export function InvoiceEditor({ mode, invoiceId }: InvoiceEditorProps) {
  const router = useRouter();

  // --- Parallel data loading -------------------------------------------------
  const clientsQuery = useQuery({
    queryKey: ['clients-options'],
    queryFn: () => api<{ items: ClientDto[] }>('/api/clients?pageSize=100&archived=false'),
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDto>('/api/auth/me'),
  });

  const invoiceQuery = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api<InvoiceDetailDto>(`/api/invoices/${invoiceId}`),
    enabled: mode === 'edit' && Boolean(invoiceId),
  });

  const editInvoice = mode === 'edit' ? invoiceQuery.data?.invoice : undefined;
  const clients = clientsQuery.data?.items ?? [];

  const initial = useMemo(
    () => buildInitialState(mode, meQuery.data, editInvoice),
    [mode, meQuery.data, editInvoice]
  );

  // --- Edit guard: only DRAFT invoices can be edited -------------------------
  if (mode === 'edit' && invoiceQuery.data && invoiceQuery.data.invoice.status !== 'DRAFT') {
    const locked = invoiceQuery.data.invoice;
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="text-lg font-semibold">Only draft invoices can be edited</h2>
            <StatusBadge status={locked.status} />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Invoice {locked.number} is {locked.status.toLowerCase()} and therefore locked. Sent,
            paid, and voided invoices can no longer be changed.
          </p>
          <Button asChild variant="outline" className="h-11 sm:h-9">
            <Link href={`/invoices/${locked.id}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to invoice
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'edit' && invoiceQuery.isError) {
    const message =
      invoiceQuery.error instanceof Error ? invoiceQuery.error.message : 'Invoice not found.';
    return (
      <EmptyState
        icon={FileX}
        title="Invoice not found"
        description={message}
        action={{ label: 'Back to invoices', onClick: () => router.push('/invoices') }}
      />
    );
  }

  // --- Loading skeleton until clients + (me | invoice) are ready --------------
  if (!initial) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading invoice form">
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full lg:col-span-2" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <InvoiceEditorForm
      key={mode === 'edit' ? invoiceId : 'create'}
      mode={mode}
      invoiceId={invoiceId}
      initial={initial}
      clients={clients}
    />
  );
}

function InvoiceEditorForm({
  mode,
  invoiceId,
  initial,
  clients,
}: {
  mode: 'create' | 'edit';
  invoiceId?: string;
  initial: FormState;
  clients: ClientDto[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initial);
  const [formError, setFormError] = useState<{ message: string; planLimit: boolean } | null>(null);

  const totals = useMemo(
    () =>
      computeTotals({
        items: form.items.map((row) => ({
          quantity: Number(row.quantity) || 0,
          unitPriceCents: toCents(row.unitPrice || '0'),
        })),
        taxRate: Number(form.taxRate) || 0,
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
      }),
    [form]
  );

  const currency = form.currency;

  // --- Validation ------------------------------------------------------------
  const clientOk = form.clientId !== '';
  const itemsOk =
    form.items.length > 0 &&
    form.items.every((row) => row.description.trim() !== '' && Number(row.quantity) > 0);
  const datesOk = form.issueDate !== '' && form.dueDate !== '' && form.dueDate >= form.issueDate;
  const isValid = clientOk && itemsOk && datesOk;

  const problems: string[] = [];
  if (!clientOk) problems.push('Select a client.');
  if (!itemsOk) problems.push('Every line needs a description and a quantity greater than zero.');
  if (!datesOk) problems.push('The due date must be on or after the issue date.');

  // --- Save mutation -----------------------------------------------------------
  const saveMutation = useMutation({
    mutationFn: async (payload: SavePayload) => {
      if (mode === 'create') {
        return api<{ invoice: InvoiceDto }>('/api/invoices', { method: 'POST', body: payload });
      }
      return api<{ invoice: InvoiceDto }>(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        body: payload,
      });
    },
    onSuccess: (data) => {
      toast.success(`${data.invoice.number} saved.`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', data.invoice.id] });
      router.push(`/invoices/${data.invoice.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        setFormError({ message: err.message, planLimit: true });
        toast.error(err.message);
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Could not save the invoice. Please try again.';
      setFormError({ message, planLimit: false });
      toast.error(message);
    },
  });

  // --- Item row helpers --------------------------------------------------------
  function patchForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { description: '', quantity: '1', unitPrice: '' }],
    }));
  }

  function removeItem(index: number) {
    setForm((current) => {
      if (current.items.length <= 1) return current;
      return { ...current, items: current.items.filter((_, i) => i !== index) };
    });
  }

  function lineAmount(row: ItemRow): string {
    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity)) return formatMoney(0, currency);
    return formatMoney(roundHalfUpCents(quantity * toCents(row.unitPrice || '0')), currency);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || saveMutation.isPending) return;
    setFormError(null);
    saveMutation.mutate({
      clientId: form.clientId,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      currency: form.currency,
      taxRate: Number(form.taxRate) || 0,
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      notes: form.notes.trim(),
      items: form.items.map((row) => ({
        description: row.description.trim(),
        quantity: Number(row.quantity) || 0,
        unitPrice: Number(row.unitPrice) || 0,
      })),
    });
  }

  const taxLabel = String(Number(form.taxRate) || 0);
  const discountPercentLabel = String(Number(form.discountValue) || 0);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      {/* Invoice details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="invoice-client">Client</Label>
            <Select value={form.clientId} onValueChange={(value) => patchForm({ clientId: value })}>
              <SelectTrigger id="invoice-client" aria-label="Client" className="w-full">
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No clients yet — create one first.
                  </div>
                ) : (
                  clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company ? `${client.name} — ${client.company}` : client.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You need at least one client.{' '}
                <Link href="/clients" className="font-medium underline underline-offset-4">
                  Go to clients
                </Link>
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-issue-date">Issue date</Label>
            <Input
              id="invoice-issue-date"
              type="date"
              value={form.issueDate}
              onChange={(e) => patchForm({ issueDate: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-due-date">Due date</Label>
            <Input
              id="invoice-due-date"
              type="date"
              value={form.dueDate}
              onChange={(e) => patchForm({ dueDate: e.target.value })}
              aria-invalid={form.issueDate !== '' && form.dueDate !== '' && form.dueDate < form.issueDate}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-currency">Currency</Label>
            <Select value={form.currency} onValueChange={(value) => patchForm({ currency: value })}>
              <SelectTrigger id="invoice-currency" aria-label="Currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-tax-rate">Tax rate (%)</Label>
            <Input
              id="invoice-tax-rate"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.taxRate}
              onChange={(e) => patchForm({ taxRate: e.target.value })}
              inputMode="decimal"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-discount-type">Discount</Label>
            <Select
              value={form.discountType}
              onValueChange={(value) => patchForm({ discountType: value as DiscountType })}
            >
              <SelectTrigger id="invoice-discount-type" aria-label="Discount type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-discount-value">
              Discount value {form.discountType === 'PERCENT' ? '(%)' : ''}
            </Label>
            <Input
              id="invoice-discount-value"
              type="number"
              min={0}
              step={0.01}
              value={form.discountValue}
              onChange={(e) => patchForm({ discountValue: e.target.value })}
              disabled={form.discountType === 'NONE'}
              inputMode="decimal"
            />
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {/* Column headings (desktop only) */}
          <div className="hidden items-center gap-3 sm:flex" aria-hidden>
            <span className="flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </span>
            <span className="w-24 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Qty
            </span>
            <span className="w-32 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unit price
            </span>
            <span className="w-24 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Amount
            </span>
            <span className="w-9" aria-hidden />
          </div>

          {form.items.map((row, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Input
                className="flex-1"
                value={row.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                placeholder="Description of work or product"
                aria-label={`Line ${index + 1} description`}
              />
              <Input
                className="w-full sm:w-24"
                type="number"
                min={0}
                step="any"
                value={row.quantity}
                onChange={(e) => updateItem(index, { quantity: e.target.value })}
                placeholder="Qty"
                aria-label={`Line ${index + 1} quantity`}
                inputMode="decimal"
              />
              <Input
                className="w-full sm:w-32"
                type="number"
                min={0}
                step={0.01}
                value={row.unitPrice}
                onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                placeholder="0.00"
                aria-label={`Line ${index + 1} unit price`}
                inputMode="decimal"
              />
              <span
                className="hidden w-24 text-right text-sm tabular-nums text-muted-foreground sm:block"
                aria-hidden
              >
                {lineAmount(row)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 self-end sm:size-9 sm:self-auto"
                aria-label="Remove line"
                onClick={() => removeItem(index)}
                disabled={form.items.length <= 1}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}

          <div>
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={addItem}>
              <Plus className="h-4 w-4" aria-hidden />
              Add line
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.notes}
            onChange={(e) => patchForm({ notes: e.target.value })}
            placeholder="Payment terms, thank-you note, bank details… (optional)"
            rows={3}
            aria-label="Invoice notes"
          />
        </CardContent>
      </Card>

      {/* Totals preview */}
      <Card className="ml-auto w-full max-w-xs">
        <CardContent className="space-y-2 p-6 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatMoney(totals.subtotalCents, currency)}</span>
          </div>
          {totals.discountCents > 0 ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">
                {form.discountType === 'PERCENT' ? `Discount (${discountPercentLabel}%)` : 'Discount'}
              </span>
              <span className="tabular-nums">-{formatMoney(totals.discountCents, currency)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Tax ({taxLabel}%)</span>
            <span className="tabular-nums">{formatMoney(totals.taxCents, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(totals.totalCents, currency)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {formError ? (
        <Alert variant={formError.planLimit ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertTitle>
            {formError.planLimit ? 'Plan limit reached' : 'Could not save the invoice'}
          </AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{formError.message}</span>
            {formError.planLimit ? (
              <Button asChild size="sm" className="h-11 sm:h-8">
                <Link href="/billing">Upgrade</Link>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Actions */}
      <div className="grid gap-2">
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => router.back()}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={!isValid || saveMutation.isPending}>
            {saveMutation.isPending
              ? 'Saving…'
              : mode === 'create'
                ? 'Create invoice'
                : 'Save changes'}
          </Button>
        </div>
        {problems.length > 0 ? (
          <p className="text-sm text-muted-foreground sm:text-right" aria-live="polite">
            {problems.join(' ')}
          </p>
        ) : null}
      </div>
    </form>
  );
}
