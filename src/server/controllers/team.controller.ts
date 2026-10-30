import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, requireRole } from '@/server/middleware/auth';
import { inviteMember, listWorkspaceMembers } from '@/server/services/auth.service';
import { inviteMemberSchema } from '@/server/validation';

/** Team management is OWNER-only (MEMBERs cannot view or invite). */
export async function list(req: NextRequest) {
  const user = await getSessionUser(req);
  requireRole(user, ['OWNER'], 'manage the team');
  const members = await listWorkspaceMembers(user.accountId);
  return NextResponse.json({ members });
}

export async function invite(req: NextRequest) {
  const user = await getSessionUser(req);
  requireRole(user, ['OWNER'], 'invite teammates');
  const input = inviteMemberSchema.parse(await req.json());
  const member = await inviteMember(user.accountId, input);
  return NextResponse.json({ member }, { status: 201 });
}
