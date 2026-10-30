import { NextResponse, type NextRequest } from 'next/server';
import { ApiError } from '@/server/errors';
import { markOverdueInvoices } from '@/server/services/invoices.service';

/**
 * Daily cron endpoint — marks past-due SENT invoices as OVERDUE.
 *
 * On Vercel, configure it in vercel.json (already included in the repo root):
 *   { "crons": [{ "path": "/api/cron/overdue", "schedule": "0 3 * * *" }] }
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
 *
 * When CRON_SECRET is unset (local development) the endpoint is open so the
 * flow can be triggered manually.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) throw ApiError.unauthorized('Invalid cron secret.');
  }
  const updated = await markOverdueInvoices();
  return NextResponse.json({ ok: true, updated });
}

export const GET = run;
export const POST = run;
