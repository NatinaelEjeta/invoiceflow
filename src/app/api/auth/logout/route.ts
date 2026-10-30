import { route } from '@/server/http';
import * as auth from '@/server/controllers/auth.controller';

export const POST = route(() => auth.logout());
