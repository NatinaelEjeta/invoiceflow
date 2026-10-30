import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as billing from '@/server/controllers/billing.controller';

export const POST = route(async (req: NextRequest) => billing.portal(req));
