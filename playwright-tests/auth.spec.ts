import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText(/Welcome Back|Sign In/i);
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Error message is shown on the page or error page is shown
    await page.waitForTimeout(2000);
    const pageContent = await page.content();
    const hasError =
      pageContent.includes('Invalid') ||
      pageContent.includes('CredentialsSignin') ||
      pageContent.includes('error');
    expect(hasError).toBeTruthy();
  });

  test('login form accepts input', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'test@example.com');
    await page.fill('#password', 'password123');
    await expect(page.locator('#username')).toHaveValue('test@example.com');
    await expect(page.locator('#password')).toHaveValue('password123');
  });
});
