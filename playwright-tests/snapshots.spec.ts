import { test, expect } from '@playwright/test';

test.describe('Page Snapshots', () => {
  test('login page screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveScreenshot('login-page.png');
  });

  test('home page screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveScreenshot('home-page.png');
  });

  test('events page screenshot', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveScreenshot('events-page.png');
  });

  test('potluck page screenshot', async ({ page }) => {
    await page.goto('/potluck');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveScreenshot('potluck-page.png');
  });

  test('photos page screenshot', async ({ page }) => {
    await page.goto('/photos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveScreenshot('photos-page.png');
  });

  test('login form with error state screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('login-error.png');
  });
});
