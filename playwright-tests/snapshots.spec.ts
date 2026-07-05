import { test, expect } from '@playwright/test';

const pages = [
  { path: '/login', name: 'login-page' },
  { path: '/', name: 'home-page' },
  { path: '/events', name: 'events-page' },
  { path: '/potluck', name: 'potluck-page' },
  { path: '/photos', name: 'photos-page' },
];

const themes = ['light', 'dark'] as const;

for (const page of pages) {
  for (const theme of themes) {
    test(`screenshot ${page.name}-${theme}`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      await pw.evaluate((cls: string) => {
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(cls);
        document.documentElement.setAttribute('data-theme', cls);
        localStorage.setItem('theme', cls);
      }, theme);

      await pw.waitForTimeout(300);
      await expect(pw).toHaveScreenshot(`${page.name}-${theme}.png`);
    });
  }

  test(`screenshot ${page.name}-login-error`, async ({ page: pw }) => {
    await pw.goto('/login');
    await pw.waitForLoadState('networkidle');
    await pw.fill('#username', 'invalid@example.com');
    await pw.fill('#password', 'wrongpassword');
    await pw.click('button[type="submit"]');
    await pw.waitForTimeout(1500);
    await expect(pw).toHaveScreenshot(`${page.name}-login-error.png`);
  });
}
