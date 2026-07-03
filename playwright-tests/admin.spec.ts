import { test } from '@playwright/test';

test.describe('Admin - Event Management', () => {
  test('unauthenticated user is redirected from admin pages', async ({ page }) => {
    await page.goto('/admin/events');
    // Should redirect to home or login since not authenticated
    await page.waitForURL(/\/(login|(\/)?)$/);
  });
});
