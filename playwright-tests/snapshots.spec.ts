import { test, expect } from '@playwright/test';

type Theme = 'default' | 'notion' | 'workspace';
type ColorMode = 'light' | 'dark';

const themes: { theme: Theme; colorMode: ColorMode }[] = [
  { theme: 'default', colorMode: 'light' },
  { theme: 'default', colorMode: 'dark' },
  { theme: 'notion', colorMode: 'light' },
  { theme: 'notion', colorMode: 'dark' },
  { theme: 'workspace', colorMode: 'light' },
  { theme: 'workspace', colorMode: 'dark' },
];

const pages = [
  { path: '/login', name: 'login-page' },
  { path: '/', name: 'home-page' },
  { path: '/events', name: 'events-page' },
  { path: '/potluck', name: 'potluck-page' },
  { path: '/photos', name: 'photos-page' },
];

for (const page of pages) {
  for (const { theme, colorMode } of themes) {
    const snapshotName = `${page.name}-${theme}-${colorMode}.png`;

    test(`screenshot ${snapshotName}`, async ({ page: pw }) => {
      await pw.goto(page.path);
      await pw.waitForLoadState('domcontentloaded');

      await pw.evaluate(
        ({ theme, colorMode }) => {
          document.documentElement.classList.remove('dark', 'notion', 'notion.dark', 'workspace', 'workspace.dark');
          if (theme !== 'default') {
            document.documentElement.classList.add(
              colorMode === 'dark' ? `${theme}.dark` : theme
            );
          } else if (colorMode === 'dark') {
            document.documentElement.classList.add('dark');
          }
        },
        { theme, colorMode }
      );

      await pw.waitForTimeout(100);
      await expect(pw).toHaveScreenshot(snapshotName);
    });
  }

  test(`screenshot ${page.name}-login-error`, async ({ page: pw }) => {
    await pw.goto('/login');
    await pw.waitForLoadState('domcontentloaded');
    await pw.fill('#username', 'invalid@example.com');
    await pw.fill('#password', 'wrongpassword');
    await pw.click('button[type="submit"]');
    await pw.waitForTimeout(1000);
    await expect(pw).toHaveScreenshot(`${page.name}-login-error.png`);
  });
}
