# Wire real photo URLs and seed data

## Status

Done — `prisma/seed.ts` extended with full dataset: household, users, dependent, published event, 3 potluck slots, 2 RSVPs with potluck signups, 8 photos with reactions, and a used invitation. Acceptance criteria met.

## Description

Even before the full upload pipeline lands, the app needs seeded
photos so:

- The `/events/[id]` page shows the photo grid.
- The `/photos` page shows real cards.
- Developers can test the reaction button (already implemented).
- Lighthouse / a11y tests have content to crawl.

Implement:

- Extend `prisma/seed.ts` to insert 6–10 sample `Photo` rows per event,
  pointing at placeholder URLs (e.g., picsum.photos with a seed for
  determinism).
- Create a `scripts/seed-photos.ts` that uploads local fixture images to
  MinIO for end-to-end testing.

## Acceptance criteria

- `npm run db:seed` produces a database with at least one event, 2–3
  potluck slots, 6+ photos, 2 RSVPs.
- `/photos` and `/events/[id]` render non-empty states after seed.
- Reaction button is exercisable.

## Files

- `prisma/seed.ts` (extend with photos, potluck slots, RSVPs,
  households)
- `scripts/seed-photos.ts` (create — optional)
- `package.json` (new scripts if needed)
