'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, ReceiptText } from 'lucide-react';
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
import { api, ApiError } from '@/lib/api';
import type { MeDto } from '@/lib/types';

interface RegisterForm {
  workspaceName: string;
  name: string;
  email: string;
  password: string;
}

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;
type TouchedMap = Partial<Record<keyof RegisterForm, boolean>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};
  if (!values.workspaceName.trim()) {
    errors.workspaceName = 'Workspace name is required';
  }
  if (!values.name.trim()) {
    errors.name = 'Your name is required';
  }
  if (!values.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  return errors;
}

/**
 * Standalone registration page (no app shell).
 * Creates a workspace + owner account, then seeds ['me'] and redirects.
 */
export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<RegisterForm>({
    workspaceName: '',
    name: '',
    email: '',
    password: '',
  });
  const [touched, setTouched] = useState<TouchedMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  function updateField(field: keyof RegisterForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function markTouched(field: keyof RegisterForm) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function fieldError(field: keyof RegisterForm): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !isValid) return;
    setError(null);
    setBusy(true);
    try {
      const data = await api<MeDto>('/api/auth/register', {
        method: 'POST',
        body: {
          workspaceName: form.workspaceName.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        },
      });
      queryClient.setQueryData<MeDto>(['me'], data);
      toast.success('Workspace created — welcome!');
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
                  <CardTitle className="text-xl">Create your workspace</CardTitle>
                  <CardDescription>
                    One workspace, unlimited invoices on PRO. Free plan includes 5
                    active clients and 10 invoices/month.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="workspaceName">Workspace name</Label>
                  <Input
                    id="workspaceName"
                    value={form.workspaceName}
                    onChange={(event) =>
                      updateField('workspaceName', event.target.value)
                    }
                    onBlur={() => markTouched('workspaceName')}
                    placeholder="Acme Studio"
                    autoComplete="organization"
                    disabled={busy}
                    aria-invalid={fieldError('workspaceName') ? true : undefined}
                    aria-describedby={
                      fieldError('workspaceName') ? 'workspaceName-error' : undefined
                    }
                  />
                  {fieldError('workspaceName') && (
                    <p
                      id="workspaceName-error"
                      className="text-xs text-destructive"
                      role="alert"
                    >
                      {errors.workspaceName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    onBlur={() => markTouched('name')}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    disabled={busy}
                    aria-invalid={fieldError('name') ? true : undefined}
                    aria-describedby={fieldError('name') ? 'name-error' : undefined}
                  />
                  {fieldError('name') && (
                    <p id="name-error" className="text-xs text-destructive" role="alert">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    onBlur={() => markTouched('email')}
                    placeholder="you@company.com"
                    autoComplete="email"
                    disabled={busy}
                    aria-invalid={fieldError('email') ? true : undefined}
                    aria-describedby={fieldError('email') ? 'email-error' : undefined}
                  />
                  {fieldError('email') && (
                    <p id="email-error" className="text-xs text-destructive" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    onBlur={() => markTouched('password')}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    disabled={busy}
                    aria-invalid={fieldError('password') ? true : undefined}
                    aria-describedby="password-hint"
                  />
                  {fieldError('password') ? (
                    <p id="password-error" className="text-xs text-destructive" role="alert">
                      {errors.password}
                    </p>
                  ) : (
                    <p id="password-hint" className="text-xs text-muted-foreground">
                      At least 8 characters.
                    </p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Could not create workspace</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-10 w-full"
                  disabled={busy || !isValid}
                  aria-busy={busy}
                >
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Create workspace
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
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
