import { test, expect } from '@playwright/test';
import { getFixtures, loginAs } from './helpers';

test.describe('Public - Login', () => {
  test('login page renders the dev credentials form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText(/Welcome back|Sign in/i);
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('rejects unknown credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'nobody@example.com');
    await page.fill('#password', 'wrong-password');
    await page.click('button[type="submit"]');

    // NextAuth renders the error on the /login page. Wait for either the
    // error banner or the same form to remain; either way the redirect must
    // not have happened.
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/login/);
  });

  test('home page redirects authenticated users to /', async ({ page }) => {
    await loginAs(page, 'maria');
    expect(page.url()).not.toContain('/login');
  });

  test('authenticated home replaces the CTA with RSVP shortcut', async ({ page }) => {
    await loginAs(page, 'maria');
    // Maria already has an RSVP in the seed, so the CTA must reflect that.
    // The CTA reads "View your RSVP →" when Maria has an active RSVP, or
    // "RSVP now →" otherwise. Either way, the home page must render the
    // authenticated CTA instead of the unauthenticated "Sign in" / "See
    // the invitation" pair.
    await expect(page.getByRole('link', { name: /View your RSVP|RSVP now/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('Public - Home', () => {
  test('renders the brand and the next gathering chip', async ({ page }) => {
    const { events } = await getFixtures();
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Family Picnic/i);
    await expect(page.getByRole('heading', { name: 'Upcoming gatherings' })).toBeVisible();
    await expect(page.getByRole('link', { name: events.mainEvent.name })).toBeVisible();
  });

  test('renders the unauthenticated CTA when signed out', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Sign in/i }).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /See the invitation|Browse Events/i }),
    ).toBeVisible();
  });
});

test.describe('Public - Events list', () => {
  test('shows the upcoming and past sections', async ({ page }) => {
    const { events } = await getFixtures();

    await page.goto('/events');
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Past gatherings' })).toBeVisible();

    await expect(page.getByRole('link', { name: events.mainEvent.name })).toBeVisible();
    await expect(page.getByRole('link', { name: events.pastEvent.name })).toBeVisible();
  });

  test('hides draft events from the public list', async ({ page }) => {
    const { events } = await getFixtures();

    await page.goto('/events');
    await expect(page.getByRole('link', { name: events.draftEvent.name })).toHaveCount(0);
  });

  test('shows the calendar view', async ({ page }) => {
    await page.goto('/events/calendar');
    await expect(page.getByRole('heading', { name: 'Event Calendar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'List View' })).toBeVisible();
  });

  test('event detail page renders the hero, RSVP card, and potluck CTA', async ({ page }) => {
    const { events } = await getFixtures();

    await page.goto(`/events/${events.mainEvent.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: events.mainEvent.name }),
    ).toBeVisible();
    await expect(page.getByText('Riverside Park, Shelter #3')).toBeVisible();
    await expect(page.getByTestId('event-detail-potluck-cta')).toBeVisible();
  });

  test('event detail page hides the potluck signup for unauthenticated users', async ({ page }) => {
    const { events } = await getFixtures();

    await page.goto(`/events/${events.mainEvent.id}`);
    // The "bring a dish" card is rendered only for logged-in users with a
    // confirmed RSVP.
    await expect(page.getByText('Bring a dish')).toHaveCount(0);
  });
});

test.describe('Public - Auth gates', () => {
  test('unauthenticated /profile redirects to /login', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL(/\/login/);
  });

  test('unauthenticated /household redirects to /login', async ({ page }) => {
    await page.goto('/household');
    await page.waitForURL(/\/login/);
  });

  test('unauthenticated /my-events redirects to /login', async ({ page }) => {
    await page.goto('/my-events');
    await page.waitForURL(/\/login/);
  });

  test('unauthenticated /admin/* redirects to /', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForURL((url) => !url.pathname.startsWith('/admin/'));
  });
});
