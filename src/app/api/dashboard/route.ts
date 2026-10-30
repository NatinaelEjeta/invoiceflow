import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as dashboard from '@/server/controllers/dashboard.controller';

export const GET = route(async (req: NextRequest) => dashboard.stats(req));
