'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Info, Save } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import type { MeDto, SettingsDto } from '@/lib/types';
import { CURRENCIES } from '@/lib/constants';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface SettingsForm {
  name: string;
  logoText: string;
  defaultCurrency: string;
  defaultTaxRate: string;
  footerNote: string;
}

function hydrate(settings: SettingsDto): SettingsForm {
  return {
    name: settings.name,
    logoText: settings.logoText,
    defaultCurrency: settings.defaultCurrency,
    defaultTaxRate: String(settings.defaultTaxRate),
    footerNote: settings.footerNote,
  };
}

export default function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: SettingsDto }>('/api/settings'),
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDto>('/api/auth/me'),
  });

  const settings = settingsQuery.data?.settings;
  const readOnly = meQuery.data ? meQuery.data.user.role !== 'OWNER' : false;

  function retry() {
    void settingsQuery.refetch();
    void meQuery.refetch();
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Workspace preferences applied to new invoices.
        </p>
      </header>

      {settingsQuery.isLoading ? (
        <SettingsSkeleton />
      ) : settingsQuery.isError ? (
        <Card className="max-w-2xl">
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load settings</AlertTitle>
              <AlertDescription>
                {settingsQuery.error instanceof Error
                  ? settingsQuery.error.message
                  : 'Something went wrong while loading your workspace settings.'}
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : settings ? (
        // The key remounts the form when a different settings record arrives,
        // so the state is always seeded from the server without effects.
        <WorkspaceForm key={settings.id} settings={settings} readOnly={readOnly} />
      ) : null}
    </div>
  );
}

function WorkspaceForm({ settings, readOnly }: { settings: SettingsDto; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(() => hydrate(settings));
  const [inlineError, setInlineError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: {
      name: string;
      logoText: string;
      defaultCurrency: string;
      defaultTaxRate: number;
      footerNote: string;
    }) => api<{ settings: SettingsDto }>('/api/settings', { method: 'PATCH', body: input }),
    onSuccess: () => {
      setInlineError(null);
      toast.success('Settings saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : 'Could not save the workspace settings.';
      setInlineError(message);
      toast.error(message);
    },
  });

  const busy = save.isPending;
  const disabled = readOnly || busy;

  function setField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setInlineError('Workspace name is required.');
      return;
    }
    const tax = Number(form.defaultTaxRate);
    if (form.defaultTaxRate.trim() === '' || Number.isNaN(tax) || tax < 0 || tax > 100) {
      setInlineError('Enter a default tax rate between 0 and 100.');
      return;
    }
    setInlineError(null);
    save.mutate({
      name,
      logoText: form.logoText.trim(),
      defaultCurrency: form.defaultCurrency,
      defaultTaxRate: tax,
      footerNote: form.footerNote.trim(),
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          {readOnly
            ? 'These preferences are managed by the workspace owner.'
            : 'Applied to every new invoice you create.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {readOnly ? (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>
              Only the workspace owner can change workspace settings.
            </AlertDescription>
          </Alert>
        ) : null}

        <form id="workspace-settings" onSubmit={submit} className="grid gap-5" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="settings-name">Workspace name</Label>
            <Input
              id="settings-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              disabled={disabled}
              required
              maxLength={80}
              autoComplete="organization"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="settings-logo-text">Logo text</Label>
            <Input
              id="settings-logo-text"
              value={form.logoText}
              onChange={(e) => setField('logoText', e.target.value)}
              disabled={disabled}
              maxLength={8}
              placeholder="ACME"
            />
            <p className="text-xs text-muted-foreground">
              Up to 8 characters — shown as your logo
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="settings-currency">Default currency</Label>
              <Select
                value={form.defaultCurrency}
                onValueChange={(value) => setField('defaultCurrency', value)}
                disabled={disabled}
              >
                <SelectTrigger id="settings-currency" className="w-full" aria-label="Default currency">
                  <SelectValue placeholder="Choose a currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="settings-tax-rate">Default tax rate</Label>
              <Input
                id="settings-tax-rate"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.01}
                value={form.defaultTaxRate}
                onChange={(e) => setField('defaultTaxRate', e.target.value)}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Pre-filled on new invoices, in percent
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="settings-footer-note">Invoice footer note</Label>
            <Textarea
              id="settings-footer-note"
              rows={3}
              value={form.footerNote}
              onChange={(e) => setField('footerNote', e.target.value)}
              disabled={disabled}
              maxLength={500}
              placeholder="Thank you for your business!"
            />
            <p className="text-xs text-muted-foreground">
              Shown at the bottom of every invoice and PDF
            </p>
          </div>
        </form>

        {inlineError ? (
          <Alert variant="destructive" className="mt-5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{inlineError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between gap-4 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Plan</span>
          <Badge variant={settings.plan === 'PRO' ? 'default' : 'secondary'}>
            {settings.plan}
          </Badge>
        </div>
        {!readOnly ? (
          <Button type="submit" form="workspace-settings" disabled={disabled}>
            <Save className="h-4 w-4" aria-hidden />
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-32" />
      </CardFooter>
    </Card>
  );
}
