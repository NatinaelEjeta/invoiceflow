'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { InvoiceDto, PaymentMethod } from '@/lib/types';
import { formatMoney, toCents } from '@/lib/money';
import { todayInputValue } from '@/lib/dates';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface PaymentDialogProps {
  invoice: InvoiceDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog to record a payment against an invoice (SENT/OVERDUE only).
 * The form lives inside DialogContent, which Radix unmounts when the dialog
 * closes — so every open starts from fresh defaults (full balance, today).
 */
export function PaymentDialog({ invoice, open, onOpenChange }: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment — {invoice.number}</DialogTitle>
          <DialogDescription>
            Log an incoming payment against this invoice. The balance updates immediately.
          </DialogDescription>
        </DialogHeader>
        <PaymentForm invoice={invoice} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  invoice,
  onOpenChange,
}: {
  invoice: InvoiceDto;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const balance = Math.max(0, invoice.totalCents - invoice.paidCents);
  const [amount, setAmount] = useState(() => (balance / 100).toFixed(2));
  const [paidAt, setPaidAt] = useState(() => todayInputValue());
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [note, setNote] = useState('');

  const amountCents = toCents(amount);
  const exceedsBalance = amountCents > balance;
  const amountInvalid = amountCents <= 0;

  const mutation = useMutation({
    mutationFn: () => {
      const trimmedNote = note.trim();
      return api<{ invoice: InvoiceDto }>(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        body: {
          amountCents,
          paidAt,
          method,
          ...(trimmedNote ? { note: trimmedNote } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success('Payment recorded.');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not record the payment.');
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amountInvalid || exceedsBalance || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Outstanding balance:{' '}
        <span className="font-medium tabular-nums text-foreground">
          {formatMoney(balance, invoice.currency)}
        </span>
      </p>

      <div className="grid gap-2">
        <Label htmlFor="payment-amount">Amount</Label>
        <div className="relative">
          <Input
            id="payment-amount"
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amountInvalid || exceedsBalance}
            inputMode="decimal"
            className="pr-14"
            required
          />
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
            aria-hidden
          >
            {invoice.currency}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="payment-date">Date</Label>
          <Input
            id="payment-date"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-method">Method</Label>
          <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
            <SelectTrigger id="payment-method" aria-label="Payment method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payment-note">Note</Label>
        <Input
          id="payment-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reference, transaction ID… (optional)"
          maxLength={200}
        />
      </div>

      {amountInvalid && amount !== '' ? (
        <p className="text-sm text-destructive">Enter an amount greater than zero.</p>
      ) : null}
      {exceedsBalance ? (
        <p className="text-sm text-destructive" role="alert">
          Amount exceeds the outstanding balance.
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => onOpenChange(false)}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-11 sm:h-9"
          disabled={mutation.isPending || amountInvalid || exceedsBalance}
        >
          {mutation.isPending ? 'Recording…' : 'Record payment'}
        </Button>
      </DialogFooter>
    </form>
  );
}
