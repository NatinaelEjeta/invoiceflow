import { execSync } from 'node:child_process';
import path from 'node:path';

const TEST_DB_URL =
  'file:' + path.join(process.cwd(), 'db', 'vitest.db').replace(/\\/g, '/') + '?connection_limit=1';

export default function globalSetup() {
  // Reset the dedicated test database before any test runs.
  execSync('npx prisma db push --force-reset --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
}
