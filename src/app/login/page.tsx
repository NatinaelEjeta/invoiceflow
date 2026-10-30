'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, ReceiptText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { api, ApiError } from '@/lib/api';
import { DEMO_ACCOUNTS } from '@/lib/constants';
import type { MeDto } from '@/lib/types';

/**
 * Standalone login page (no app shell).
 * On success the MeDto response is seeded into the query cache under ['me']
 * so the authenticated app renders immediately without a loading flash.
 */
export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(nextEmail: string, nextPassword: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<MeDto>('/api/auth/login', {
        method: 'POST',
        body: { email: nextEmail.trim(), password: nextPassword },
      });
      queryClient.setQueryData<MeDto>(['me'], data);
      router.replace('/dashboard');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    void doLogin(email, password);
  }

  function handleDemoLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    if (busy) return;
    // Fill the fields for visual feedback, then submit immediately.
    setEmail(account.email);
    setPassword(account.password);
    void doLogin(account.email, account.password);
  }

  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <main className="grid flex-1 place-items-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                  aria-hidden="true"
                >
                  <ReceiptText className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <CardTitle className="text-xl">InvoiceFlow</CardTitle>
                  <CardDescription>Sign in to your workspace</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    disabled={busy}
                    aria-invalid={error ? true : undefined}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    aria-invalid={error ? true : undefined}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Sign in failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-10 w-full"
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Sign in
                </Button>
              </form>

              <section aria-labelledby="demo-accounts-heading" className="space-y-3">
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <h2
                    id="demo-accounts-heading"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Demo accounts
                  </h2>
                  <Separator className="flex-1" />
                </div>

                <div className="space-y-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <Button
                      key={account.email}
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-between gap-3 py-3 text-left"
                      onClick={() => handleDemoLogin(account)}
                      disabled={busy}
                      aria-label={`Sign in as ${account.label}`}
                    >
                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="text-sm font-medium">{account.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {account.description}
                        </span>
                      </span>
                      <Sparkles
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Button>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            New to InvoiceFlow?{' '}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create a workspace
            </Link>
          </p>
        </div>
      </main>

      <footer className="mt-auto px-4 pb-6 pt-2">
        <p className="text-center text-sm text-muted-foreground">
          © {year} InvoiceFlow — Simple invoicing for small teams
        </p>
      </footer>
    </div>
  );
}
