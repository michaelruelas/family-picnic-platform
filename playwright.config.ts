import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The e2e suite runs against an isolated port (3100) so it never collides
 * with a developer's `bun run dev` server on 3000. The webServer command
 * uses `bun run start:e2e` which sets NODE_ENV=test and DEV_AUTH_ENABLED=true
 * so the dev credentials provider is on by default.
 */
export default defineConfig({
  testDir: './playwright-tests',
  testMatch: ['**/*.spec.ts'],

  // The e2e suite mutates the database. Even though each test file reseeds
  // in beforeAll, two parallel files stepping on each other is a
  // flake-time-bomb. Run sequentially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Global setup reseeds the database once before any test runs. Each
  // individual spec can call reseedDatabase() inside its own beforeAll if it
  // mutates state and another spec depends on the result.
  globalSetup: './playwright-tests/helpers/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Drop the service worker and cache before each test. The app
    // registers a service worker that aggressively caches HTML and
    // JS assets in the dev environment, which made the post-login
    // navigation bounce between cached and fresh pages and broke
    // every URL-based assertion. Clearing the SW per test keeps the
    // suite deterministic.
    storageState: undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // The dev server takes the port from the `PORT` env var, which we set
    // below. The command is `next dev` rather than a build+start pair so
    // the suite does not need a production build to run.
    command: `bun run dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PORT: String(PORT),
      NODE_ENV: 'test',
      DEV_AUTH_ENABLED: 'true',
      DEV_AUTH_USERNAME: 'admin',
      DEV_AUTH_PASSWORD: 'password123',
      // NextAuth uses NEXTAUTH_URL to build callback URLs. The default
      // value in .env points to localhost:3000, which is the dev server
      // port, not the e2e port. Override so the callback redirect lands
      // on the e2e server, not the developer's running dev server.
      NEXTAUTH_URL: BASE_URL,
    },
  },
});
