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

A one-time script to merge duplicate `RSVP` rows that the pre-fix re-registration bug could have created for the same `(eventId, userId)`. The current schema enforces `@@unique([eventId, userId])`, so the script finds zero duplicates on a healthy database and exits clean. Run it only if you suspect legacy duplicates from before the in-place update fix shipped.

- Default (`bun run db:backfill-rsvp-duplicates`): dry-run. Prints the planned winner per group with no writes.
- With `--apply`: merges the most recent RSVP per group into the winner, reassigns any `PotluckSignup` rows from losers to the winner, and writes one `RSVP_MERGE` audit entry per loser. Exits non-zero on any per-group failure.
- Idempotent: re-running after a successful `--apply` finds no duplicates and exits clean.
