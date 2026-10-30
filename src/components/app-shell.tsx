'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Users,
  UserCog,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';

interface AppShellProps {
  user: { name: string; email: string; role: Role };
  account: { name: string; plan: string; logoText: string };
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/team', label: 'Team', icon: UserCog, ownerOnly: true },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Logo({ account }: { account: AppShellProps['account'] }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2" aria-label="Go to dashboard">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        {(account.logoText || account.name).slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{account.name}</span>
        <span className="block text-xs leading-tight text-muted-foreground">
          {account.plan === 'PRO' ? 'PRO plan' : 'FREE plan'}
        </span>
      </span>
    </Link>
  );
}

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 py-2">
      {NAV.filter((item) => !item.ownerOnly || role === 'OWNER').map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      toast.success('Password updated.');
      onOpenChange(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>
            Minimum 8 characters. Demo accounts (@invoiceflow.demo) cannot change their password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppShell({ user, account, children }: AppShellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const logout = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Logo account={account} />
        </div>
        <NavLinks role={user.role} />
        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <Badge variant="secondary" className="mt-2">
            {user.role}
          </Badge>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-col md:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 items-center border-b px-4">
                <Logo account={account} />
              </div>
              <NavLinks role={user.role} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant={account.plan === 'PRO' ? 'default' : 'secondary'} className="hidden sm:inline-flex">
              {account.plan}
            </Badge>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open user menu">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {initials || 'U'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
                  <KeyRound className="h-4 w-4" /> Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  <LogOut className="h-4 w-4" /> {logout.isPending ? 'Signing out…' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        {/* Sticky footer: sticks to the bottom on short pages, pushed down naturally on long ones. */}
        <footer className="mt-auto border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
            <p>
              <span className="font-semibold text-foreground">InvoiceFlow</span> — simple invoicing for small teams
            </p>
            <p>
              {account.name} · {account.plan} plan
            </p>
          </div>
        </footer>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
