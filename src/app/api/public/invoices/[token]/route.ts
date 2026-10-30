import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as invoices from '@/server/controllers/invoices.controller';

type Ctx = { params: Promise<{ token: string }> };

export const GET = route<Ctx>(async (req: NextRequest, ctx) => invoices.getPublic(req, ctx));
