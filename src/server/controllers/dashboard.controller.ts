import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/server/middleware/auth';
import { getDashboard } from '@/server/services/dashboard.service';

export async function stats(req: NextRequest) {
  const user = await getSessionUser(req);
  const data = await getDashboard(user.accountId);
  return NextResponse.json({ ...data, plan: user.account.plan });
}
