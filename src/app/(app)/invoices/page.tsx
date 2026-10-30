'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, Plus, Search, SearchX } from 'lucide-react';
import { api } from '@/lib/api';
import type { InvoiceListDto } from '@/lib/types';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { StatusBadge } from '@/components/invoice/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VOID', label: 'Void' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

export default function InvoicesPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  // Debounce the search box: only hit the API 300ms after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useQuery({
    queryKey: ['invoices', page, search, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (status !== 'ALL') params.set('status', status);
      return api<InvoiceListDto>(`/api/invoices?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const data = listQuery.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (data?.page ?? page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min((data?.page ?? page) * PAGE_SIZE, total);
  const isFiltered = search !== '' || status !== 'ALL';

  function handleStatusChange(value: string) {
    setStatus(value as StatusFilter);
    setPage(1);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, send, and track invoices. Select a row to see the full details.
          </p>
        </div>
        <Button asChild className="h-11 sm:h-9">
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" aria-hidden />
            New invoice
          </Link>
        </Button>
      </header>

      {/* Toolbar: search + status filter on one row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search number or client…"
            aria-label="Search invoices by number or client"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger
            aria-label="Filter invoices by status"
            className="w-full sm:w-44"
          >
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {listQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div>
              <p className="font-semibold">Couldn&apos;t load invoices</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Something went wrong. Please try again.'}
              </p>
            </div>
            <Button variant="outline" className="h-11 sm:h-9" onClick={() => listQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : listQuery.isPending || !data ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : data.items.length === 0 ? (
        isFiltered || page > 1 ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            description={
              page > 1
                ? 'This page has no invoices — go back a page or adjust your search and filter.'
                : 'No invoices match your search or filter. Try different keywords or clear the status filter.'
            }
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice — numbering starts at INV-0001."
            action={{ label: 'New invoice', onClick: () => router.push('/invoices/new') }}
          />
        )
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue date</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    tabIndex={0}
                    aria-label={`Open invoice ${invoice.number}`}
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/invoices/${invoice.id}`);
                      }
                    }}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:underline"
                      >
                        {invoice.number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{invoice.client.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(invoice.issueDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(invoice.dueDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(invoice.totalCents, invoice.currency)}
                      {invoice.paidCents > 0 && invoice.status !== 'PAID' ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          paid {formatMoney(invoice.paidCents, invoice.currency)}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-11 gap-1 px-3 sm:h-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || listQuery.isFetching}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-11 gap-1 px-3 sm:h-8"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || listQuery.isFetching}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
