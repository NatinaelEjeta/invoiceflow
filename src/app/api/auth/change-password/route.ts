import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as auth from '@/server/controllers/auth.controller';

export const POST = route(async (req: NextRequest) => auth.changePassword(req));
