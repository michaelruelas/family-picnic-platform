import 'dotenv/config';
import { spawn } from 'node:child_process';
import { Client } from 'pg';

/**
 * Playwright global setup. Runs once before any test file.
 *
 * Two responsibilities:
 *  1. Verify the database is reachable. If DATABASE_URL is missing or the
 *     connection fails, fail fast with a clear message — Playwright's
 *     default error is two pages of stack trace.
 *  2. Run the e2e seed so every test starts from a known fixture. We do
 *     this in a child process so the seed script can use its own Prisma
 *     client and not interfere with the dev server's connection pool.
 */

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      '[e2e global-setup] DATABASE_URL is not set. Copy .env.example to .env and configure it before running e2e tests.',
    );
  }

  // Cheap liveness check. If the DB is down, fail here instead of after
  // Playwright spends 90 seconds booting the web server.
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } catch (err) {
    throw new Error(
      `[e2e global-setup] cannot connect to PostgreSQL at ${databaseUrl}. ` +
        'Is the database running? Try `bun run db:push` first. ' +
        `Underlying error: ${(err as Error).message}`,
      { cause: err },
    );
  } finally {
    await client.end().catch(() => {});
  }

  // Run the e2e seed. We use spawnSync semantics via a promise so failures
  // surface with the seed's own output.
  await new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['run', 'prisma/seed.e2e.ts'], {
      stdio: 'inherit',
      env: { ...process.env, E2E_SEED: '1' },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma/seed.e2e.ts exited with code ${code}`));
    });
    child.on('error', reject);
  });
}
