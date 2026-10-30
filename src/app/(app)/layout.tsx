import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getServerSession } from '@/server/middleware/auth';
import type { Role } from '@/lib/types';

/**
 * Server-side guard for every authenticated page: the session cookie is
 * verified and the user reloaded from the database on each request.
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  return (
    <AppShell
      user={{ name: session.name, email: session.email, role: session.role as Role }}
      account={{ name: session.account.name, plan: session.account.plan, logoText: session.account.logoText }}
    >
      {children}
    </AppShell>
  );
}
