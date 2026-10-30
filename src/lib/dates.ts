/** UTC date helpers. InvoiceFlow stores ALL dates as UTC DateTimes. */

/** "2025-03-05" -> Date at 2025-03-05T00:00:00.000Z (UTC midnight). */
export function utcMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Format a date (string or Date) in UTC, e.g. "Mar 5, 2025". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Format a timestamp in UTC, e.g. "Mar 5, 2025, 14:30". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Today as a YYYY-MM-DD string (UTC). */
export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "2025-08" month key in UTC. */
export function utcMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "2025-08" -> "Aug 2025". */
export function monthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

/** True when `due` (ISO date) is before today (UTC calendar day). */
export function isPastDue(due: string | Date): boolean {
  const date = typeof due === 'string' ? new Date(due) : due;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dueUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return dueUtc < todayUtc;
}
