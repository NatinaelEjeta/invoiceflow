'use client';

import { useParams } from 'next/navigation';
import { InvoiceEditor } from '@/components/invoice/invoice-editor';

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Edit invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the client, dates, line items, and totals — draft invoices only.
        </p>
      </header>
      {id ? <InvoiceEditor mode="edit" invoiceId={id} /> : null}
    </div>
  );
}
