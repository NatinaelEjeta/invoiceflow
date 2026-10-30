import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as clients from '@/server/controllers/clients.controller';

export const GET = route(async (req: NextRequest) => clients.list(req));
export const POST = route(async (req: NextRequest) => clients.create(req));
