# Commands Reference

All commands use `bun` (not `npm`).

## Development

```bash
bun run dev          # Start Next.js dev server on localhost:3000
bun run build        # Production build
bun run start        # Start production server (requires build first)
```

## Testing

```bash
bun test             # Run all tests (Vitest) - excludes playwright-tests/
bun run test:watch   # Watch mode for development
bun run test:coverage # Coverage report

bun run test:e2e    # Run Playwright e2e tests (playwright-tests/)
bun run test:e2e -- --ui  # Run with Playwright UI
```

## Quality

```bash
bun run lint         # ESLint
bun run typecheck    # TypeScript type checking
bun run ci           # Full CI suite: typecheck + lint + format:check + test:coverage
bun run format       # Format all files with Prettier
bun run format:check # Check formatting without modifying
```

## Local CI Validation (wrkflw)

The pre-commit hook validates the CI YAML with `wrkflw` then runs `bun run ci` locally.
Install wrkflw to validate CI YAML syntax before pushing:

### Installation

```bash
cargo install wrkflw
```

Or with Homebrew:

```bash
brew install wrkflw
```

### Manual Usage

```bash
wrkflw validate .github/workflows/ci.yml   # Validate workflow YAML syntax
```

wrkflw watch --event push # Watch mode for auto-rerun
wrkflw run --job validate .github/workflows/ci.yml # Specific job

````

## Database

```bash
bun run db:generate  # Generate Prisma client after schema changes
bun run db:push      # Push schema to database (dev)
bun run db:migrate   # Run migrations (creates revision history)
bun run db:seed      # Seed database with sample data
bun run db:studio    # Open Prisma Studio (GUI)
bun run db:validate  # Validate Prisma schema
bun run db:backfill-rsvp-duplicates        # One-time RSVP dedup, dry-run
bun run db:backfill-rsvp-duplicates --apply  # Same script, writes changes
bun run db:backfill-registration-fees        # One-time registration-fee pin, dry-run
bun run db:backfill-registration-fees --apply  # Same script, writes changes
````

## One-Command Dev Setup

```bash
bash scripts/dev.sh
```

This script:

1. Starts PostgreSQL via Docker
2. Creates `.env` from `.env.example` if missing
3. Runs `bun install`
4. Generates Prisma client
5. Pushes schema to database
6. Seeds with sample data
7. Installs Playwright browsers
8. Starts Next.js dev server

## Playwright E2E Setup

Before running e2e tests for the first time:

```bash
bun run db:push      # Push schema (needed after schema changes)
bun run db:seed      # Seed test users
npx playwright install chromium  # Install browser
```

E2E test files are in `playwright-tests/`:

- `auth.spec.ts` - Login/logout flows
- `admin.spec.ts` - Admin event management
- `user.spec.ts` - User RSVP and browsing
- `snapshots.spec.ts` - Page screenshot tests

## Environment Setup

```bash
cp .env.example .env  # Then fill in secrets
```

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - App URL (http://localhost:3000 for dev)
- `NEXTAUTH_SECRET` - Random string for session encryption
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - Google OAuth credentials

Optional:

- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` - Twilio SMS credentials. `TWILIO_PHONE_NUMBER` must be a valid E.164 number (e.g. `+15551234567`). In Kubernetes it is supplied via the OpenBao-backed `nextjs-secrets` secret (`secret/family-picnic-dev/nextjs:twilio-phone-number`) and consumed by the `nextjs` deployment through an `ExternalSecret` resource. `scripts/populate-openbao-secrets.sh` round-trips the value idempotently.
- `SENDGRID_*` - SendGrid email credentials
- `S3_*` - S3-compatible storage for photos
- `PHOTOPRISM_*` - PhotoPrism credentials

## Dev Auth

Enable dev credentials login:

```bash
DEV_AUTH_ENABLED=true
DEV_AUTH_PASSWORD=password123
```

Test accounts (all use password `password123`):

| Email                           | Role  |
| ------------------------------- | ----- |
| admin@family-picnic.example.com | Admin |
| maria.garcia@example.com        | User  |
| carlos.garcia@example.com       | User  |
| lisa.thompson@example.com       | User  |
| bob.thompson@example.com        | User  |
| priya.patel@example.com         | User  |

Seeding resets data - run `bun run db:seed` after `db:push` or `db:migrate`.

## RSVP Duplicate Backfill (FPP-28)

A one-time script to merge duplicate `RSVP` rows that the pre-fix re-registration bug may have left behind. The current schema enforces `@@unique([eventId, userId])`, so the script finds zero duplicates on a healthy database and exits clean. Run it only if you suspect legacy duplicates from before the in-place update fix shipped.

- Default (`bun run db:backfill-rsvp-duplicates`): dry-run. Prints the planned winner per group with no writes.
- With `--apply`: merges the most recent RSVP per group into the winner, reassigns any `PotluckSignup` rows from losers to the winner, and writes one `RSVP_MERGE` audit entry per loser. Exits non-zero on any per-group failure.
- Idempotent: re-running after a successful `--apply` finds no duplicates and exits clean.

## Registration Fee Backfill (FPP-14)

A one-time script to pin `Registration.amountCents` to 0 for every existing row. Per FPP-14 ("no charge applied retroactively") and FPP-48 ("backfill: existing households marked paid=0; no charge applied retroactively"). Settled rows (`PAID` / `REFUNDED` / `FORFEITED` / `CANCELLED`) are left alone — they reflect real money movement that already happened — but they still receive an audit entry so the run leaves a complete trail.

- Default (`bun run db:backfill-registration-fees`): dry-run. Prints the count of registrations scanned with no writes.
- With `--apply`: sets `amountCents = 0` on every non-settled row, writes one `REGISTRATION_FEE_BACKFILL` audit entry per registration (old + new value), exits non-zero on any per-row failure.
- Idempotent: a second `--apply` run finds every row already at 0, writes zero updates, and still emits one audit entry per registration.

## Audit Log Action Strings (FPP-78)

The `AdminAuditLog` table is the source of truth for paid-feature forensics. The tRPC `auditedAdminProcedure` middleware writes a path-keyed entry for every mutation (e.g. `admin.refund`), and the procedures below add a richer, payment-specific entry on top. The stable action strings are listed here so admin queries and the FPP-74 smoke checklist can reference them by name. Any rename must update this table, the corresponding test in `tests/integration/fpp-78-payment-audit-coverage.test.ts`, and the call site in the same PR.

| Action                     | Fires when                                                                                       | Call site                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `payment.intentCreated`    | `payment.createPaymentIntent` succeeds and Stripe returns a new PaymentIntent.                   | `src/server/routers/payment.router.ts` — `createPaymentIntentInner`                   |
| `payment.intentFailed`     | Stripe rejects `paymentIntents.create` in `payment.createPaymentIntent`.                         | `src/server/routers/payment.router.ts` — `catch` of `createPaymentInner`              |
| `payment.succeeded`        | Stripe webhook fires `payment_intent.succeeded` and the charge flips to `SUCCEEDED`.             | `src/app/api/stripe/webhook/route.ts` — `handlePaymentIntentSucceeded`                |
| `payment.failed`           | Stripe webhook fires `payment_intent.payment_failed` or `payment_intent.canceled`.               | `src/app/api/stripe/webhook/route.ts` — `handlePaymentIntentFailed`                   |
| `payment.refunded`         | Admin issues an in-app refund via `admin.refund`.                                                | `src/server/routers/admin.router.ts` — `refund`                                       |
| `payment.refundReconciled` | Stripe webhook fires `charge.refunded` (full) or `charge.updated` (partial) — reconciles in-app. | `src/app/api/stripe/webhook/route.ts` — `handleChargeRefunded`, `handleChargeUpdated` |
| `payment.forfeited`        | Admin forfeits a paid registration (no-show) via `admin.forfeit`.                                | `src/server/routers/admin.router.ts` — `forfeit`                                      |
| `payment.receiptResent`    | Admin re-sends the receipt email via `admin.resendReceipt` on a succeeded charge.                | `src/server/routers/admin.router.ts` — `resendReceipt`                                |

The smoke check for FPP-74 ("Audit log writes on signup, RSVP change, registration, payment") confirms each of these rows lands under the matching `(userId, eventId, action)` tuple. The dedicated test `tests/integration/fpp-78-payment-audit-coverage.test.ts` replays a webhook stream end-to-end and asserts exactly one audit row per state transition.
