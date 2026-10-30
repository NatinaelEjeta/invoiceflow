import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as invoices from '@/server/controllers/invoices.controller';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req: NextRequest, ctx) => invoices.get(req, ctx));
export const PATCH = route<Ctx>(async (req: NextRequest, ctx) => invoices.update(req, ctx));
