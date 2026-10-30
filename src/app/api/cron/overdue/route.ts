import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as cron from '@/server/controllers/cron.controller';

export const GET = route(async (req: NextRequest) => cron.GET(req));
export const POST = route(async (req: NextRequest) => cron.POST(req));
