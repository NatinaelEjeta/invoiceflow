import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, requireRole } from '@/server/middleware/auth';
import { getSettings, updateSettings } from '@/server/services/dashboard.service';
import { settingsUpdateSchema } from '@/server/validation';

export async function get(req: NextRequest) {
  const user = await getSessionUser(req);
  return NextResponse.json({ settings: getSettings(user.account) });
}

/** Only the workspace OWNER can change workspace settings. */
export async function update(req: NextRequest) {
  const user = await getSessionUser(req);
  requireRole(user, ['OWNER'], 'change workspace settings');
  const input = settingsUpdateSchema.parse(await req.json());
  const settings = await updateSettings(user.accountId, input);
  return NextResponse.json({ settings });
}
