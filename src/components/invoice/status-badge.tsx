import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/lib/types';

const STYLES: Record<InvoiceStatus, string> = {
  DRAFT: 'border-border bg-muted text-muted-foreground',
  SENT: 'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  PAID: 'border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  OVERDUE: 'border-transparent bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300',
  VOID: 'border-transparent bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STYLES[status], className)}>
      {status}
    </Badge>
  );
}
