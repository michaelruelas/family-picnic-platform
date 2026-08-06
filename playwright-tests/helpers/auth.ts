import type { Page } from '@playwright/test';
import { e2eUsers as _e2eUsers, type E2EUserKey } from './users';

/**
 * Test users that the e2e seed creates. The keys match the persona so test
 * authors can write `loginAs(page, 'maria')` instead of repeating email
 * strings everywhere.
 */
export const e2eUsers = _e2eUsers;
export type { E2EUserKey };

/**
 * Sign in via the NextAuth credentials API directly and set the session
 * cookie on the browser context.
 *
 * Why not click through the LoginForm? The dev server's RSC hydration
 * storm + the service worker (which the app registers on every page) make
 * the post-login navigation race-prone. The LoginForm uses next-auth's
 * `signIn('dev-credentials', { redirect: true })` which fires a chain of
 * CSRF + POST + window.location navigation. The dev server emits many
 * commits during hydration, and the form-driven path has at least three
 * known flakes in this stack:
 *  1. `Promise.all([waitForURL, click])` races with the RSC commit loop.
 *  2. `toHaveURL` waits for the load event which the dev server never
 *     settles while RSC is streaming.
 *  3. The service worker intercepts the post-login GET / and serves the
 *     pre-login cached page.
 *
 * Calling the credentials API directly sidesteps all three. The session
 * cookie is set the same way NextAuth sets it after a real login, and the
 * home page renders the authenticated state on the next navigation.
 */
export async function loginAs(page: Page, user: E2EUserKey): Promise<void> {
  const creds = e2eUsers[user];

  // Navigate to the dev server first. The credentials callback refuses
  // requests whose Origin does not match the configured NEXTAUTH_URL when
  // the page context has not loaded any of our pages yet, so the POST
  // returns 500. Visiting /login before the API call pins the origin.
  await page.goto('/login');

  // Fetch the CSRF token. NextAuth requires it on the credentials POST
  // and pairs it with the csrf cookie set on this same response.
  const csrfResponse = await page.context().request.get('/api/auth/csrf');
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  // POST credentials with json=true so NextAuth returns the redirect URL
  // instead of issuing a 302. The response Set-Cookie header carries the
  // session token, which the APIRequestContext applies to the browser
  // context automatically.
  const callbackUrl = new URL(page.url()).origin + '/';
  const loginResponse = await page.context().request.post('/api/auth/callback/dev-credentials', {
    form: {
      csrfToken,
      username: creds.email,
      password: creds.password,
      callbackUrl,
      json: 'true',
    },
  });
  if (!loginResponse.ok()) {
    const body = await loginResponse.text();
    throw new Error(`loginAs(${user}) failed: ${loginResponse.status()} ${body}`);
  }

  // Drop any service-worker state from previous test runs. The SW caches
  // the pre-login page; without clearing it the post-login render will
  // bounce between cached and fresh.
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  });

  // Re-navigate so the browser fetches / fresh, with the session cookie
  // attached. The first navigation after the API call sometimes sees a
  // stale session because the dev server's response cache hasn't flushed.
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Sign out by clearing the browser context's cookies. NextAuth's session
 * cookie is the only auth state, so clearing it logs the user out.
 *
 * The helper does not navigate after clearing cookies — the dev server's
 * RSC hydration churn makes `page.goto` race-prone for unauthenticated
 * renders. Callers should drive the next navigation themselves with
 * `expect(page).toHaveURL(...)` or a polling wait.
 */
export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Truncate the database and re-seed the e2e fixtures. Call this from a
 * `beforeAll` block whenever a test file mutates state so later tests
 * start from a known baseline.
 *
 * The seed runs in a child process so the Next.js dev server can keep its
 * Prisma connection pool. The seed is idempotent: it wipes the relevant
 * tables first.
 */
export async function reseedDatabase(): Promise<void> {
  const { spawn } = await import('node:child_process');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['run', 'prisma/seed.e2e.ts'], {
      stdio: 'inherit',
      env: { ...process.env, E2E_SEED: '1' },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`seed.e2e.ts exited with code ${code}`));
    });
    child.on('error', reject);
  });
}
