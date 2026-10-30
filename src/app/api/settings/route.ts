import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as settings from '@/server/controllers/settings.controller';

export const GET = route(async (req: NextRequest) => settings.get(req));
export const PATCH = route(async (req: NextRequest) => settings.update(req));
