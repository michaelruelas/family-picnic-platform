# Commands Reference

All npm scripts and CLI commands for the Family Picnic Platform.

## Development

```bash
npm run dev          # Start Next.js dev server on localhost:3000
npm run build        # Production build
npm run start        # Start production server (requires build first)
```

## Testing

```bash
npm test             # Run all tests (Vitest) - excludes playwright-tests/
npm run test:watch   # Watch mode for development
npm run test:coverage # Coverage report

npm run test:e2e    # Run Playwright e2e tests (playwright-tests/)
npm run test:e2e -- --ui  # Run with Playwright UI
```

## Quality

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking
npm run ci           # Full CI suite: typecheck + lint + test
npm run format       # Format all files with Prettier
npm run format:check # Check formatting without modifying
```

## Local CI Validation (wrkflw)

The pre-commit hook runs `wrkflw` automatically before each commit. Install wrkflw to validate CI will pass before pushing.

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
wrkflw run --runtime emulation .github/workflows/ci.yml
```

### Other Commands

```bash
wrkflw validate                       # Validate workflow YAML syntax
wrkflw tui                           # Interactive TUI
wrkflw watch --event push            # Watch mode for auto-rerun
wrkflw run --job validate .github/workflows/ci.yml  # Specific job
```

## Database

```bash
npm run db:generate  # Generate Prisma client after schema changes
npm run db:push      # Push schema to database (dev)
npm run db:migrate   # Run migrations (creates revision history)
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio (GUI)
npm run db:validate  # Validate Prisma schema
```

## One-Command Dev Setup

```bash
bash scripts/dev.sh
```

This script:

1. Starts PostgreSQL via Docker
2. Creates `.env` from `.env.example` if missing
3. Runs `npm install`
4. Generates Prisma client
5. Pushes schema to database
6. Seeds with sample data
7. Installs Playwright browsers
8. Starts Next.js dev server

## Playwright E2E Setup

Before running e2e tests for the first time:

```bash
npm run db:push      # Push schema (needed after schema changes)
npm run db:seed      # Seed test users
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

- `TWILIO_*` - Twilio SMS credentials
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

Seeding resets data - run `npm run db:seed` after `db:push` or `db:migrate`.
