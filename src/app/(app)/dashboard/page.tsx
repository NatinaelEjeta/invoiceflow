'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import type { DashboardDto } from '@/lib/types';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import { formatDate, monthKeyLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/invoice/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Chart tooltip (popover tokens so it stays correct in dark mode)
// ---------------------------------------------------------------------------

interface RevenueTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { value?: number | string }[];
}

function RevenueTooltip({ active, label, payload }: RevenueTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const amountCents = Number(payload[0]?.value ?? 0) * 100;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{formatMoney(amountCents)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

interface StatCard {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
}

function buildStats(data: DashboardDto): StatCard[] {
  return [
    {
      label: 'Outstanding',
      value: formatMoney(data.outstandingCents),
      description: 'Sent + overdue, unpaid',
      icon: Wallet,
    },
    {
      label: 'Overdue',
      value: formatMoney(data.overdueCents),
      description: 'Past due date',
      icon: AlertTriangle,
      iconClassName: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Paid this month',
      value: formatMoney(data.paidThisMonthCents),
      description: 'Collected this month',
      icon: CheckCircle2,
      iconClassName: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Active clients',
      value: String(data.activeClients),
      description: `${data.invoicesThisMonth} invoices this month`,
      icon: Users,
    },
  ];
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-4 w-36" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

function ListsSkeleton() {
  return (
    <section aria-label="Loading lists" className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-44 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-52 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Error card
// ---------------------------------------------------------------------------

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card aria-live="polite">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-950 dark:text-red-400">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">Could not load the dashboard</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden /> Try again
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardDto>('/api/dashboard'),
  });

  useEffect(() => {
    if (isError && error) {
      toast.error(error instanceof Error ? error.message : 'Could not load the dashboard.');
    }
  }, [isError, error]);

  const stats = useMemo(() => (data ? buildStats(data) : []), [data]);

  const chartData = useMemo(
    () =>
      (data?.monthlyRevenue ?? []).map((m) => ({
        label: monthKeyLabel(m.month),
        amount: m.totalCents / 100,
      })),
    [data]
  );
  const hasRevenue = chartData.some((d) => d.amount > 0);

  const topClients = useMemo(
    () => [...(data?.topClients ?? [])].sort((a, b) => b.totalCents - a.totalCents),
    [data]
  );
  const recentInvoices = data?.recentInvoices ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Revenue, outstanding invoices and activity for your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <Skeleton className="h-6 w-14" aria-hidden />
          ) : data ? (
            <Badge variant={data.plan === 'PRO' ? 'default' : 'secondary'}>{data.plan}</Badge>
          ) : null}
          <Button asChild>
            <Link href="/invoices/new">
              <Plus aria-hidden /> New invoice
            </Link>
          </Button>
        </div>
      </header>

      {isError && error ? (
        <ErrorCard
          message={error instanceof Error ? error.message : 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      ) : isPending ? (
        <>
          {/* Stat card skeletons */}
          <section aria-label="Loading metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </section>
          <ChartSkeleton />
          <ListsSkeleton />
        </>
      ) : data ? (
        <>
          {/* Stat cards */}
          <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <span className={cn('rounded-md bg-muted p-2', stat.iconClassName)}>
                    <stat.icon className="h-4 w-4" aria-hidden />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* Revenue chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Payments collected per month (last 6 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative text-muted-foreground">
                <div
                  role="img"
                  aria-label="Bar chart of payments collected per month over the last 6 months"
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        opacity={0.35}
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        dy={8}
                        tick={{ fill: 'currentColor' }}
                      />
                      <YAxis
                        width={48}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        tick={{ fill: 'currentColor' }}
                        tickFormatter={(v) => formatMoneyCompact(Number(v) * 100)}
                      />
                      <Tooltip
                        content={<RevenueTooltip />}
                        cursor={{ fill: 'currentColor', opacity: 0.08 }}
                      />
                      <Bar
                        dataKey="amount"
                        className="fill-primary"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {!hasRevenue && (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <p className="rounded-md bg-card/80 px-3 py-1.5 text-sm text-muted-foreground">
                      No payments recorded in the last 6 months.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top clients + Recent invoices */}
          <section aria-label="Top clients and recent invoices" className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top clients</CardTitle>
                <CardDescription>Highest invoiced totals</CardDescription>
              </CardHeader>
              <CardContent>
                {topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoiced clients yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {topClients.map((client, index) => (
                      <li key={client.clientId} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {client.name}
                        </span>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatMoney(client.totalCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Recent invoices</CardTitle>
                <CardDescription>The latest invoices in your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <div className="flex flex-col items-start gap-3 py-4">
                    <p className="text-sm text-muted-foreground">
                      No invoices yet — create your first one.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/invoices/new">
                        <Plus aria-hidden /> Create invoice
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableCaption className="sr-only">Recent invoices</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Number</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Issue date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentInvoices.map((invoice) => (
                          <TableRow
                            key={invoice.id}
                            className="cursor-pointer"
                            onClick={() => router.push(`/invoices/${invoice.id}`)}
                          >
                            <TableCell>
                              <Link
                                href={`/invoices/${invoice.id}`}
                                className="font-medium hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {invoice.number}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <span className="block max-w-40 truncate">{invoice.clientName}</span>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={invoice.status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(invoice.issueDate)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(invoice.totalCents, invoice.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
