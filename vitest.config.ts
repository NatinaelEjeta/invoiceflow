import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Test database: a dedicated SQLite file (db/vitest.db) that is reset by the
 * global setup (`prisma db push --force-reset`). The URL is exported through
 * `env` so the app's own Prisma client (src/lib/db.ts) points at it too.
 */
export const TEST_DB_URL =
  'file:' + path.join(process.cwd(), 'db', 'vitest.db').replace(/\\/g, '/') + '?connection_limit=1';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    env: {
      DATABASE_URL: TEST_DB_URL,
      JWT_SECRET: 'vitest-secret-0123456789abcdef',
    },
    // SQLite: run test files sequentially (never concurrently) to avoid
    // database-lock contention between workers.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
});
