'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Crown, Dices, Info, Lock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { TeamMemberDto } from '@/lib/types';
import { formatDate } from '@/lib/dates';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const DEFAULT_TEMP_PASSWORD = 'Welcome123!';
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Random 12-character alphanumeric temporary password. */
function randomPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)];
  }
  return out;
}

interface InviteForm {
  name: string;
  email: string;
  password: string;
}

const EMPTY_INVITE: InviteForm = { name: '', email: '', password: DEFAULT_TEMP_PASSWORD };

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<InviteForm>(EMPTY_INVITE);

  const teamQuery = useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ members: TeamMemberDto[] }>('/api/team'),
  });

  const members = teamQuery.data?.members;
  const forbidden = teamQuery.error instanceof ApiError && teamQuery.error.status === 403;

  const inviteMember = useMutation({
    mutationFn: (input: InviteForm) =>
      api<{ member: TeamMemberDto }>('/api/team', { method: 'POST', body: input }),
    onSuccess: (_data, input) => {
      toast.success(`Invitation created for ${input.email} — share the temporary password with them.`);
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      setInviteOpen(false);
      setInvite(EMPTY_INVITE);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not create the invitation.');
    },
  });

  // Reset the form whenever the dialog is opened so stale values never linger.
  function openInvite() {
    setInvite(EMPTY_INVITE);
    setInviteOpen(true);
  }

  function submitInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    inviteMember.mutate({
      name: invite.name.trim(),
      email: invite.email.trim(),
      password: invite.password,
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            People in your workspace. Members manage clients and invoices; only owners manage
            billing and settings.
          </p>
        </div>
        {!forbidden ? (
          <Button onClick={openInvite} className="sm:shrink-0">
            <UserPlus className="h-4 w-4" aria-hidden />
            Invite member
          </Button>
        ) : null}
      </header>

      {teamQuery.isLoading ? (
        <TeamSkeleton />
      ) : forbidden ? (
        <Card className="max-w-xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <h2 className="text-base font-semibold">Owner access required</h2>
            <p className="text-sm text-muted-foreground">
              {teamQuery.error instanceof Error ? teamQuery.error.message : 'Owner access required.'}
            </p>
            <p className="text-sm text-muted-foreground">Ask your workspace owner for access.</p>
          </CardContent>
        </Card>
      ) : teamQuery.isError ? (
        <Card>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load the team</AlertTitle>
              <AlertDescription>
                {teamQuery.error instanceof Error
                  ? teamQuery.error.message
                  : 'Something went wrong while loading your team.'}
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => void teamQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : members ? (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? 'person' : 'people'} in this workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {member.role === 'OWNER' ? (
                            <Crown
                              className="h-3.5 w-3.5 shrink-0 text-amber-500"
                              aria-label="Workspace owner"
                            />
                          ) : null}
                          {member.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(member.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Members sign in with their temporary password. Passwords can be changed from the user
              menu.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              Share the temporary password with your teammate — they can change it after signing
              in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInvite} className="grid gap-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={invite.name}
                onChange={(e) => setInvite((prev) => ({ ...prev, name: e.target.value }))}
                disabled={inviteMember.isPending}
                required
                maxLength={80}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite((prev) => ({ ...prev, email: e.target.value }))}
                disabled={inviteMember.isPending}
                required
                autoComplete="off"
                placeholder="teammate@company.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-password">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-password"
                  type="text"
                  value={invite.password}
                  onChange={(e) => setInvite((prev) => ({ ...prev, password: e.target.value }))}
                  disabled={inviteMember.isPending}
                  required
                  minLength={8}
                  className="font-mono"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setInvite((prev) => ({ ...prev, password: randomPassword() }))}
                  disabled={inviteMember.isPending}
                  aria-label="Generate a new temporary password"
                  title="Generate a new temporary password"
                >
                  <Dices className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                At least 8 characters. Tap the dice for a random one.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviteMember.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMember.isPending}>
                {inviteMember.isPending ? 'Creating…' : 'Create invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="grid grid-cols-[1fr_1.4fr_0.7fr_0.7fr] gap-4 border-b px-4 py-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="ml-auto h-4 w-14" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_0.7fr_0.7fr] items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
