'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CreditCard, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { BillingDto, MeDto } from '@/lib/types';
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
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface CheckoutResult {
  demo: boolean;
  url?: string;
}

export default function BillingPage() {
  const queryClient = useQueryClient();

  const billingQuery = useQuery({
    queryKey: ['billing'],
    queryFn: () => api<BillingDto>('/api/billing'),
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDto>('/api/auth/me'),
  });

  const billing = billingQuery.data;
  const isMember = meQuery.data?.user.role === 'MEMBER';
  const roleLoading = meQuery.isLoading;

  // Stripe redirects back to /billing?checkout=success|canceled.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      toast.success('Welcome to PRO! Your subscription is active.');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    } else if (checkout === 'canceled') {
      toast.info('Checkout canceled — you are still on the FREE plan.');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    }
    if (checkout === 'success' || checkout === 'canceled') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [queryClient]);

  const checkout = useMutation({
    mutationFn: () => api<CheckoutResult>('/api/billing/checkout', { method: 'POST' }),
    onSuccess: (data) => {
      if (data.demo) {
        toast.success('Demo billing: your workspace is now on the PRO plan!');
        void queryClient.invalidateQueries({ queryKey: ['billing'] });
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not start the upgrade.');
    },
  });

  const portal = useMutation({
    mutationFn: () => api<{ url: string }>('/api/billing/portal', { method: 'POST' }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not open the billing portal.');
    },
  });

  const upgrading = checkout.isPending || roleLoading;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Billing</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Your subscription and plan usage.
        </p>
      </header>

      {billingQuery.isLoading ? (
        <BillingSkeleton />
      ) : billingQuery.isError || !billing ? (
        <Card>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load billing</AlertTitle>
              <AlertDescription>
                {billingQuery.error instanceof Error
                  ? billingQuery.error.message
                  : 'Something went wrong while loading your subscription.'}
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => void billingQuery.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <CurrentPlanCard billing={billing} />

          <UsageCard billing={billing} />

          <div className="md:col-span-2">
            {billing.plan === 'FREE' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Upgrade to Pro</CardTitle>
                  <CardDescription>
                    Unlimited clients and invoices, priority support.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isMember ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Owner action required</AlertTitle>
                      <AlertDescription>
                        Only the workspace owner can manage billing.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      className="h-10 w-fit"
                      onClick={() => checkout.mutate()}
                      disabled={upgrading || isMember || checkout.isSuccess}
                    >
                      <Sparkles className="h-4 w-4" aria-hidden />
                      {checkout.isPending
                        ? 'Starting checkout…'
                        : billing.stripeConfigured
                          ? 'Upgrade to Pro'
                          : 'Demo billing — Upgrade to Pro'}
                    </Button>
                    {!billing.stripeConfigured ? (
                      <p className="text-xs text-muted-foreground">
                        Stripe is not configured; the upgrade runs in demo mode and switches your
                        workspace instantly.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Manage billing</CardTitle>
                  <CardDescription>
                    Subscription, invoices and payment method for this workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isMember ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Owner action required</AlertTitle>
                      <AlertDescription>
                        Only the workspace owner can manage billing.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {billing.stripeConfigured && billing.hasStripeCustomer ? (
                    <Button
                      className="h-10 w-fit"
                      onClick={() => portal.mutate()}
                      disabled={portal.isPending || isMember}
                    >
                      <CreditCard className="h-4 w-4" aria-hidden />
                      {portal.isPending ? 'Opening Stripe…' : 'Manage billing (Stripe portal)'}
                    </Button>
                  ) : !billing.stripeConfigured ? (
                    <p className="text-sm text-muted-foreground">
                      You&rsquo;re on PRO via demo billing. Add Stripe keys to manage a real
                      subscription.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Waiting for your first Stripe checkout to complete.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CurrentPlanCard({ billing }: { billing: BillingDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current plan</CardTitle>
        <CardDescription>What your workspace can do today.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold">{billing.plan}</span>
          <Badge variant={billing.plan === 'PRO' ? 'default' : 'secondary'}>
            {billing.plan === 'PRO' ? 'Pro' : 'Free'}
          </Badge>
        </div>
        {billing.subscriptionStatus ? (
          <p className="text-sm text-muted-foreground">
            Subscription status: {billing.subscriptionStatus}
          </p>
        ) : null}
        {billing.plan === 'PRO' && !billing.stripeConfigured ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Demo billing is active — no Stripe keys configured, so upgrades are instant and free.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UsageCard({ billing }: { billing: BillingDto }) {
  const { usage } = billing;
  const clientsAtLimit =
    usage.maxActiveClients !== null && usage.activeClients >= usage.maxActiveClients;
  const invoicesAtLimit =
    usage.maxInvoicesPerMonth !== null && usage.invoicesThisMonth >= usage.maxInvoicesPerMonth;
  const atLimit = clientsAtLimit || invoicesAtLimit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>How much of the plan you are using right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <UsageRow
          label="Active clients"
          used={usage.activeClients}
          max={usage.maxActiveClients}
          unlimitedUnit="active clients"
        />
        <UsageRow
          label="Invoices this month"
          used={usage.invoicesThisMonth}
          max={usage.maxInvoicesPerMonth}
          unlimitedUnit="invoices this month"
        />
        {atLimit ? (
          <Alert className="border-amber-600/40 text-amber-700 dark:border-amber-500/50 dark:text-amber-400 [&>svg]:text-current">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Plan limit reached</AlertTitle>
            <AlertDescription>
              You&rsquo;ve reached your FREE plan limit — upgrade to PRO for unlimited invoicing.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UsageRow({
  label,
  used,
  max,
  unlimitedUnit,
}: {
  label: string;
  used: number;
  max: number | null;
  unlimitedUnit: string;
}) {
  const limited = max !== null;
  const value = limited ? Math.min(100, (used / max) * 100) : 100;
  const detail = limited ? `${used} of ${max} used` : `${used} ${unlimitedUnit} — unlimited`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </div>
      <Progress value={value} aria-label={`${label}: ${detail}`} />
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-3 w-80" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
