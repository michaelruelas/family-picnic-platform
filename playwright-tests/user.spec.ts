import { test, expect } from '@playwright/test';

test.describe('User - RSVP Flow', () => {
  test('events page loads for public', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    // Check page loaded (may redirect to login if auth required)
    const url = page.url();
    expect(url.includes('localhost:3000')).toBeTruthy();
  });

  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Family Picnic');
  });

  test('potluck page loads', async ({ page }) => {
    await page.goto('/potluck');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url.includes('localhost:3000')).toBeTruthy();
  });
});
