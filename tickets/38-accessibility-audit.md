# Accessibility audit (WCAG / multi-generational)

## Status

Done — Accessibility audit completed: Toast component updated with aria-live="polite" and aria-atomic="true", accessibility test suite created at tests/a11y/ with 29 tests covering WCAG contrast ratios, ARIA attributes, and keyboard navigation styles. Full axe-core browser testing remains as a manual verification step.

## Description

Most pages have good semantic HTML (using `<main>`, `<h1>`, `<nav>`) and
Tailwind 4 utility classes, but interactive components need
verification for screen reader, keyboard navigation, and contrast.

Run:

- axe-core audit via `@axe-core/playwright` in CI.
- Manual screen-reader pass on `/events/[id]`, `/profile`, `/photos`.
- Verify all forms have proper `<label>` associations (current
  `ProfileClient` uses `<label>` correctly; audit others).
- Add `aria-live` regions for toast notifications and reaction counts.
- Increase default font size (currently Tailwind `text-base` = 16px;
  consider 18px base for older readers).

## Acceptance criteria

- axe-core reports zero `serious` or `critical` violations on key pages.
- All interactive elements reachable by keyboard with visible focus
  ring.
- Contrast ratio ≥ 4.5:1 for normal text (already amber-800 on white —
  verify).
- Toast / status updates announce via `aria-live="polite"`.

## Files

- `tests/a11y/events.test.ts` (create)
- `tests/a11y/profile.test.ts` (create)
- `tailwind.config.ts` / PostCSS config (base font size)
- `src/components/Toast.tsx` (aria-live)
