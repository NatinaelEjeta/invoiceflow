'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadInvoicePdf } from '@/lib/pdf';
import type { InvoiceDto, WorkspaceDto } from '@/lib/types';

interface InvoicePdfButtonProps {
  invoice: InvoiceDto;
  workspace: WorkspaceDto;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  label?: string;
  className?: string;
}

/** Client-side PDF export button (jsPDF + autotable, lazy-loaded). */
export function InvoicePdfButton({
  invoice,
  workspace,
  variant = 'outline',
  size = 'sm',
  label = 'Download PDF',
  className,
}: InvoicePdfButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await downloadInvoicePdf({ invoice, workspace });
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={busy} className={className} aria-label={label}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {label}
    </Button>
  );
}
