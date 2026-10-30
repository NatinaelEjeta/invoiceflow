import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/server/middleware/auth';
import { createClient, listClients, updateClient } from '@/server/services/clients.service';
import { clientCreateSchema, clientListQuerySchema, clientUpdateSchema } from '@/server/validation';

type IdCtx = { params: Promise<{ id: string }> };

export async function list(req: NextRequest) {
  const user = await getSessionUser(req);
  const query = clientListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await listClients(user.accountId, query);
  return NextResponse.json(result);
}

export async function create(req: NextRequest) {
  const user = await getSessionUser(req);
  const input = clientCreateSchema.parse(await req.json());
  const client = await createClient(user, input);
  return NextResponse.json({ client }, { status: 201 });
}

export async function update(req: NextRequest, ctx: IdCtx) {
  const user = await getSessionUser(req);
  const { id } = await ctx.params;
  const input = clientUpdateSchema.parse(await req.json());
  const client = await updateClient(user.accountId, id, input);
  return NextResponse.json({ client });
}
