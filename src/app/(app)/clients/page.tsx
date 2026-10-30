'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SearchX,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import type { ClientDto, ClientListDto } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ClientDialog } from '@/components/clients/client-dialog';
import { EmptyState } from '@/components/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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

const PAGE_SIZE = 10;

/** Select value → `archived` query param: 'false' | 'true' | 'all'. */
type StatusFilter = 'false' | 'true' | 'all';

const ARCHIVE_DESCRIPTION =
  "Archived clients don't count toward plan limits and can't be selected for new invoices.";

export default function ClientsPage() {
  const queryClient = useQueryClient();

  // Dialog state — the dialog stays mounted at page level.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDto | null>(null);

  // List state.
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('false');

  // Client pending archive confirmation.
  const [archiveTarget, setArchiveTarget] = useState<ClientDto | null>(null);

  // Debounce the search input by 300ms; any new search resets pagination.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clientsQuery = useQuery({
    queryKey: ['clients', { page, pageSize: PAGE_SIZE, search, status }],
    queryFn: async ({ signal }) => {
      const fetchPage = (targetPage: number) => {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
          search,
          archived: status,
        });
        return api<ClientListDto>(`/api/clients?${params.toString()}`, { signal });
      };

      const result = await fetchPage(page);

      // Self-heal: if the requested page fell out of range (rows archived or
      // removed since), re-fetch the last valid page instead of stranding the
      // user on an empty page.
      if (result.items.length === 0 && page > 1 && result.total > 0) {
        const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
        return fetchPage(Math.min(page, lastPage));
      }
      return result;
    },
    placeholderData: keepPreviousData,
  });

  const items = clientsQuery.data?.items ?? [];
  const total = clientsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Trust the server response for what is actually on screen (it can differ
  // from the requested page after the self-healing fetch above).
  const shownPage = clientsQuery.data?.page ?? page;

  // Archive and restore share one mutation (both are PATCHes of `archived`).
  const setArchived = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api<{ client: ClientDto }>(`/api/clients/${id}`, { method: 'PATCH', body: { archived } }),
    onSuccess: (_data, variables) => {
      toast.success(variables.archived ? 'Client archived.' : 'Client restored.');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update client.');
    },
  });

  const openNew = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const openEdit = (client: ClientDto) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const from = total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(shownPage * PAGE_SIZE, total);
  const isEmpty = !clientsQuery.isPending && !clientsQuery.isError && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">People and companies you invoice.</p>
        </div>
        <Button onClick={openNew} className="w-full sm:w-auto">
          <Plus aria-hidden="true" />
          New client
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, company or email…"
            className="pl-9"
            aria-label="Search clients"
          />
        </div>
        <Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Active</SelectItem>
            <SelectItem value="true">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card className="gap-0 p-0">
        {clientsQuery.isError ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-destructive">
              {clientsQuery.error instanceof Error
                ? clientsQuery.error.message
                : 'Failed to load clients.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => clientsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : clientsQuery.isPending ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Client</TableHead>
                  <TableHead className="px-4">Email</TableHead>
                  <TableHead className="px-4">Invoices</TableHead>
                  <TableHead className="px-4">Added</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                  <TableHead className="px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-44" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : isEmpty ? (
          <div className="p-4 sm:p-6">
            {total === 0 && !search ? (
              <EmptyState
                icon={Users}
                title="No clients yet"
                description="Add your first client to start invoicing."
                action={{ label: 'New client', onClick: openNew }}
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="No matches"
                description="Try a different search term or filter."
              />
            )}
          </div>
        ) : (
          <>
            <div
              className={cn(
                'overflow-x-auto',
                clientsQuery.isPlaceholderData && 'opacity-60 transition-opacity'
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Client</TableHead>
                    <TableHead className="px-4">Email</TableHead>
                    <TableHead className="px-4">Invoices</TableHead>
                    <TableHead className="px-4">Added</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="px-4">
                        <div className="font-medium">{client.name}</div>
                        {client.company ? (
                          <div className="text-sm text-muted-foreground">{client.company}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {client.email ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 tabular-nums">
                        {client._count?.invoices ?? 0}
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {formatDate(client.createdAt)}
                      </TableCell>
                      <TableCell className="px-4">
                        {client.archived ? (
                          <Badge variant="outline">Archived</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Client actions">
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onSelect={() => openEdit(client)}>
                              <Pencil aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                            {client.archived ? (
                              <DropdownMenuItem
                                onSelect={() =>
                                  setArchived.mutate({ id: client.id, archived: false })
                                }
                              >
                                <ArchiveRestore aria-hidden="true" />
                                Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setArchiveTarget(client)}
                              >
                                <Archive aria-hidden="true" />
                                Archive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center gap-3 border-t px-4 py-3 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Showing {from}–{to} of {total} {total === 1 ? 'client' : 'clients'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, shownPage - 1))}
                  disabled={shownPage <= 1}
                >
                  <ChevronLeft aria-hidden="true" />
                  Prev
                </Button>
                <span className="min-w-20 text-center text-sm tabular-nums text-muted-foreground">
                  Page {shownPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(shownPage + 1)}
                  disabled={shownPage >= totalPages}
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Archive confirmation */}
      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>{ARCHIVE_DESCRIPTION}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (archiveTarget) {
                  setArchived.mutate({ id: archiveTarget.id, archived: true });
                }
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / edit dialog (kept mounted at page level) */}
      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
      />
    </div>
  );
}
