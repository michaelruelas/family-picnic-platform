import { test, expect } from '@playwright/test';
import { getAllThemeCombinations } from '../src/lib/themes';

const pages = [
  { path: '/login', name: 'login-page' },
  { path: '/', name: 'home-page' },
  { path: '/events', name: 'events-page' },
  { path: '/potluck', name: 'potluck-page' },
  { path: '/photos', name: 'photos-page' },
];

for (const page of pages) {
  for (const { theme, colorMode } of getAllThemeCombinations()) {
    const snapshotName = `${page.name}-${theme.id}-${colorMode}.png`;

    test(`screenshot ${snapshotName}`, async ({ page: pw }) => {
      const themeClass = theme.className(colorMode);

      await pw.goto(page.path, { waitUntil: 'networkidle' });

      await pw.evaluate((cls: string) => {
        document.documentElement.classList.remove(
          'dark',
          'light',
          'notion',
          'notion-dark',
          'notion-light',
          'workspace',
          'workspace-dark',
          'workspace-light',
        );
        document.documentElement.classList.add(cls);
        document.documentElement.setAttribute('data-theme', cls);
        localStorage.setItem('next-themes-theme', cls);
      }, themeClass);

      await pw.waitForTimeout(300);
      await expect(pw).toHaveScreenshot(snapshotName);
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
