import { test, expect } from '@playwright/test';
import { getFixtures } from './helpers';

/**
 * Smoke tests. Every public route in the application must return 200 and
 * render the right h1. These tests guard against accidental deep-link
 * regressions and are cheap to run.
 *
 * Authenticated routes are exercised in the public/user/admin spec files
 * with the appropriate login persona. The smoke test only covers the
 * signed-out surface.
 */
test.describe('Smoke - public routes', () => {
  test('home', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Family Picnic/i);
  });

  test('events list', async ({ page }) => {
    const response = await page.goto('/events');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
  });

  test('events calendar', async ({ page }) => {
    const response = await page.goto('/events/calendar');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Event Calendar' })).toBeVisible();
  });

  test('event detail', async ({ page }) => {
    const { events } = await getFixtures();
    const response = await page.goto(`/events/${events.mainEvent.id}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: events.mainEvent.name }),
    ).toBeVisible();
  });

  test('event potluck', async ({ page }) => {
    const { events } = await getFixtures();
    const response = await page.goto(`/events/${events.mainEvent.id}/potluck`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Potluck' })).toBeVisible();
  });

  test('login', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('my-events redirects when signed out', async ({ page }) => {
    await page.goto('/my-events');
    await page.waitForURL(/\/login/);
  });

  test('household redirects when signed out', async ({ page }) => {
    await page.goto('/household');
    await page.waitForURL(/\/login/);
  });

  test('profile redirects when signed out', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL(/\/login/);
  });

  test('admin redirects to / when signed out', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForURL((url) => !url.pathname.startsWith('/admin/'));
  });

  test('404 page for unknown event', async ({ page }) => {
    await page.goto('/events/this-id-does-not-exist');
    await expect(page.getByText(/can.*t find that page|404|not found/i)).toBeVisible();
  });
});
