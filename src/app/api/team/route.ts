import type { NextRequest } from 'next/server';
import { route } from '@/server/http';
import * as team from '@/server/controllers/team.controller';

export const GET = route(async (req: NextRequest) => team.list(req));
export const POST = route(async (req: NextRequest) => team.invite(req));
