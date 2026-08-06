# E2E Testing

The Playwright suite lives in `playwright-tests/`. It runs the full stack —
server, Prisma, NextAuth, Stripe mocks where applicable — against a real
database and browser.

## Quick start

```bash
# 1. Make sure the dev database is running and the schema is current.
bun run db:push

# 2. Seed the e2e fixtures. The seed wipes the e2e-relevant tables
#    and rebuilds a deterministic state.
bun run db:seed:e2e

# 3. Run the suite. Playwright boots a Next.js server on port 3100
#    in NODE_ENV=test so it never collides with `bun run dev` on 3000.
bun run test:e2e
```

The `webServer` block in `playwright.config.ts` boots the server on port 3100
automatically. Reuse the server with `reuseExistingServer: !CI` so repeated
runs are fast.

## Architecture

```
playwright-tests/
├── helpers/
│   ├── auth.ts            # loginAs, logout, e2eUsers map
│   ├── api.ts             # typed wrappers around the REST admin/RSVP/potluck endpoints
│   ├── fixtures.ts        # reads the seeded ids out of the DB (cached)
│   ├── global-setup.ts    # boots the e2e seed before the suite runs
│   └── index.ts           # barrel export
├── public.spec.ts         # signed-out happy paths (home, events, calendar, login)
├── user.spec.ts           # user flows (auth, RSVP, potluck, household, profile)
├── admin.spec.ts          # admin flows (events CRUD, invitations, audit log, comms)
└── smoke.spec.ts          # every public route returns 200 + correct h1
```

## Seeding

`prisma/seed.e2e.ts` is the test seed. It is separate from
`prisma/seed.ts` (the developer seed) because:

- The test seed wipes rows on every run, the dev seed is upsert-only.
- The test seed creates a user with a `null` household and a `null`
  `onboardingCompletedAt` to exercise the onboarding wizard.
- The test seed uses dynamic dates (`now + N days`) so the events list
  always has live, future events regardless of when the suite runs.

Run the seed on its own:

```bash
bun run db:seed:e2e
```

Run it before an individual test file:

```ts
test.beforeEach(async () => {
  await reseedDatabase();
});
```

The Playwright global setup runs the seed once before any spec. Per-file
re-seeding is opt-in and reserved for tests that mutate state.

## CI

E2E tests run in CI on the same docker-compose stack as the dev database.
The CI workflow:

1. Boots PostgreSQL.
2. Runs `prisma db push`.
3. Runs `prisma/seed.e2e.ts` (the test seed).
4. Runs `npx playwright test --reporter=list`.

The local CI mirror (`scripts/dev.sh`) performs the same steps so a
developer can validate the full suite before pushing.

## When tests fail

| Symptom                              | Likely cause                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL is not set`            | Copy `.env.example` to `.env` and configure it.                                                 |
| `e2e fixtures not found`             | The seed never ran. Run `bun run db:seed:e2e`.                                                  |
| Login form submits but the URL stays | `DEV_AUTH_ENABLED` is not set on the web server. Check the env block in `playwright.config.ts`. |
| Tests pass locally but flake in CI   | The seed is async; the web server may boot before the seed completes. Add a wait.               |
| Stale events after a manual seed run | The test seed truncates first. Manually loading rows will be wiped on the next test run.        |

## Writing new tests

1. Read the existing helpers in `helpers/`. Add a new helper to
   `helpers/api.ts` rather than calling `fetch` directly so future tests
   reuse the same conventions.
2. For UI assertions, prefer `data-testid` over text selectors. The
   app already exposes test IDs on the RSVP card, potluck slots, and the
   bottom sheet — see `src/components/event/*` and `src/components/potluck/*`.
3. If a test creates state, call `reseedDatabase()` in `beforeEach`. The
   Playwright config runs one worker so concurrent state contamination is
   not an issue, but cross-spec contamination is.
