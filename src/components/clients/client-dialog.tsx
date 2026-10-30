'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowUpCircle, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { ClientDto } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Textarea } from '@/components/ui/textarea';

interface ClientFormValues {
  name: string;
  email: string;
  company: string;
  address: string;
  taxNumber: string;
}

const EMPTY_FORM: ClientFormValues = {
  name: '',
  email: '',
  company: '',
  address: '',
  taxNumber: '',
};

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Client being edited, or `null` to create a new one. */
  client: ClientDto | null;
  /** Called after the client was saved successfully. */
  onSaved?: () => void;
}

export function ClientDialog({ open, onOpenChange, client, onSaved }: ClientDialogProps) {
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (values: ClientFormValues) => {
      // The server treats empty strings as null, so trimmed values are safe.
      const body = {
        name: values.name.trim(),
        email: values.email.trim(),
        company: values.company.trim(),
        address: values.address.trim(),
        taxNumber: values.taxNumber.trim(),
      };
      return client
        ? api<{ client: ClientDto }>(`/api/clients/${client.id}`, { method: 'PATCH', body })
        : api<{ client: ClientDto }>('/api/clients', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(client ? 'Client updated.' : 'Client created.');
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      if (error instanceof ApiError && error.status === 402) {
        // FREE plan limit reached — keep the dialog open and offer an upgrade.
        setPlanLimitMessage(message);
      }
      toast.error(message);
    },
  });

  const isPending = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit client' : 'New client'}</DialogTitle>
          <DialogDescription>
            Client details appear on invoices you create for them.
          </DialogDescription>
        </DialogHeader>

        {/* Radix unmounts the dialog content while closed, so the fields below
            remount — and therefore reset — every time the dialog opens. The
            `key` additionally covers switching between clients. */}
        <ClientDialogFields
          key={client?.id ?? 'new'}
          defaultValues={
            client
              ? {
                  name: client.name,
                  email: client.email ?? '',
                  company: client.company ?? '',
                  address: client.address ?? '',
                  taxNumber: client.taxNumber ?? '',
                }
              : EMPTY_FORM
          }
          pending={isPending}
          planLimitMessage={planLimitMessage}
          onSubmit={(values) => saveMutation.mutate(values)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ClientDialogFieldsProps {
  defaultValues: ClientFormValues;
  pending: boolean;
  planLimitMessage: string | null;
  onSubmit: (values: ClientFormValues) => void;
  onCancel: () => void;
}

/** Controlled form fields; remounted (state reset) on every dialog open. */
function ClientDialogFields({
  defaultValues,
  pending,
  planLimitMessage,
  onSubmit,
  onCancel,
}: ClientDialogFieldsProps) {
  const [form, setForm] = useState<ClientFormValues>(defaultValues);

  const update =
    (field: keyof ClientFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      {planLimitMessage ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Plan limit reached</AlertTitle>
          <AlertDescription>
            <p>{planLimitMessage}</p>
            <Button asChild size="sm" variant="outline" className="mt-1">
              <Link href="/billing">
                <ArrowUpCircle aria-hidden="true" />
                Upgrade to Pro
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="client-name">
          Name <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Input
          id="client-name"
          name="name"
          value={form.name}
          onChange={update('name')}
          placeholder="Acme Corporation"
          required
          autoFocus
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="client-email">Email</Label>
        <Input
          id="client-email"
          name="email"
          type="email"
          value={form.email}
          onChange={update('email')}
          placeholder="billing@acme.com"
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="client-company">Company</Label>
        <Input
          id="client-company"
          name="company"
          value={form.company}
          onChange={update('company')}
          placeholder="Acme Corporation Ltd."
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="client-address">Address</Label>
        <Textarea
          id="client-address"
          name="address"
          rows={2}
          value={form.address}
          onChange={update('address')}
          placeholder="Street, city, postal code, country"
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="client-tax-number">Tax number</Label>
        <Input
          id="client-tax-number"
          name="taxNumber"
          value={form.taxNumber}
          onChange={update('taxNumber')}
          placeholder="VAT / tax ID"
          disabled={pending}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
