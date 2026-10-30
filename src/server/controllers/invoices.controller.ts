import { NextResponse, type NextRequest } from 'next/server';
import { ApiError } from '@/server/errors';
import { getSessionUser } from '@/server/middleware/auth';
import {
  createInvoice,
  getInvoice,
  getPublicInvoice,
  listInvoices,
  recordPayment,
  sendInvoiceByEmail,
  updateInvoice,
  updateInvoiceStatus,
  type WorkspaceInfo,
} from '@/server/services/invoices.service';
import {
  invoiceCreateSchema,
  invoiceListQuerySchema,
  invoiceStatusUpdateSchema,
  paymentCreateSchema,
} from '@/server/validation';

type IdCtx = { params: Promise<{ id: string }> };
type TokenCtx = { params: Promise<{ token: string }> };

export async function list(req: NextRequest) {
  const user = await getSessionUser(req);
  const query = invoiceListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await listInvoices(user.accountId, query);
  return NextResponse.json(result);
}

export async function create(req: NextRequest) {
  const user = await getSessionUser(req);
  const input = invoiceCreateSchema.parse(await req.json());
  const invoice = await createInvoice(user, input);
  return NextResponse.json({ invoice }, { status: 201 });
}

export async function get(req: NextRequest, ctx: IdCtx) {
  const user = await getSessionUser(req);
  const { id } = await ctx.params;
  const invoice = await getInvoice(user.accountId, id);
  const workspace: WorkspaceInfo = {
    name: user.account.name,
    logoText: user.account.logoText,
    footerNote: user.account.footerNote,
  };
  return NextResponse.json({ invoice, workspace });
}

export async function update(req: NextRequest, ctx: IdCtx) {
  const user = await getSessionUser(req);
  const { id } = await ctx.params;
  const input = invoiceCreateSchema.parse(await req.json());
  const invoice = await updateInvoice(user.accountId, id, input);
  return NextResponse.json({ invoice });
}

export async function updateStatus(req: NextRequest, ctx: IdCtx) {
  const user = await getSessionUser(req);
  const { id } = await ctx.params;
  const { status } = invoiceStatusUpdateSchema.parse(await req.json());
  const invoice = await updateInvoiceStatus(user.accountId, id, status);
  return NextResponse.json({ invoice });
}

export async function addPayment(req: NextRequest, ctx: IdCtx) {
  const user = await getSessionUser(req);
  const { id } = await ctx.params;
  const input = paymentCreateSchema.parse(await req.json());
  const invoice = await recordPayment(user.accountId, id, input);
  return NextResponse.json({ invoice }, { status: 201 });
}

export async function sendEmail(req: NextRequest, ctx: IdCtx) {
  const user = await getSessionUser(req);
  const { id } = await ctx.params;
  const result = await sendInvoiceByEmail(user, id);
  return NextResponse.json(result);
}

/** Public read-only invoice by share token — no login required. */
export async function getPublic(_req: NextRequest, ctx: TokenCtx) {
  const { token } = await ctx.params;
  const invoice = await getPublicInvoice(token);
  if (!invoice) throw ApiError.notFound('Invoice not found. The link may be invalid or the invoice was deleted.');

  const { account, payments, ...fields } = invoice;
  void payments; // payments are intentionally not exposed on the public page
  return NextResponse.json({
    invoice: fields,
    workspace: { name: account.name, logoText: account.logoText, footerNote: account.footerNote },
  });
}
