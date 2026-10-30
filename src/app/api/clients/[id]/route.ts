import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as clients from '@/server/controllers/clients.controller';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, ctx) => clients.update(req, ctx));
