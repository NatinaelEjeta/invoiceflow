import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as invoices from '@/server/controllers/invoices.controller';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req: NextRequest, ctx) => invoices.updateStatus(req, ctx));
