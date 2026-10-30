import type { Metadata } from 'next';
import { InvoiceEditor } from '@/components/invoice/invoice-editor';

export const metadata: Metadata = {
  title: 'New invoice — InvoiceFlow',
};

export default function NewInvoicePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">New invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Numbering is sequential per workspace (INV-0001, INV-0002, …).
        </p>
      </header>
      <InvoiceEditor mode="create" />
    </div>
  );
}
