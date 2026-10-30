import { redirect } from 'next/navigation';
import { getServerSession } from '@/server/middleware/auth';

/** Entry point: signed in -> dashboard, otherwise -> login. */
export default async function Home() {
  const session = await getServerSession();
  redirect(session ? '/dashboard' : '/login');
}
