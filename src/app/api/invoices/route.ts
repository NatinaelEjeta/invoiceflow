import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as invoices from '@/server/controllers/invoices.controller';

export const GET = route(async (req: NextRequest) => invoices.list(req));
export const POST = route(async (req: NextRequest) => invoices.create(req));
