# AGENTS.md

Developer guide for the Family Picnic Platform codebase. Full documentation is in `docs/agents/`.

## Quick Commands

### Development

```bash
npm run dev          # Start Next.js dev server on localhost:3000
npm run build        # Production build
npm run start        # Start production server (requires build first)
```

### Testing & Quality

```bash
npm test             # Run all tests (Vitest)
npm run test:watch   # Watch mode for development
npm run test:coverage # Coverage report
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking
npm run ci           # Full CI suite: typecheck + lint + test
```

### Code Formatting

```bash
npm run format       # Format all files with Prettier
npm run format:check # Check formatting without modifying
```

### Database

```bash
npm run db:generate  # Generate Prisma client after schema changes
npm run db:push      # Push schema to database (dev)
npm run db:migrate   # Run migrations (creates revision history)
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio (GUI)
npm run db:validate  # Validate Prisma schema
```

### One-Command Dev Setup

```bash
bash scripts/dev.sh
```

### E2E Testing

```bash
npm run test:e2e          # Run Playwright e2e tests
npm run test:e2e -- --ui   # Run with Playwright UI
```

Setup for first run:

```bash
npm run db:push            # Push schema
npm run db:seed            # Seed test users
npx playwright install chromium
```

Test files: `playwright-tests/`

## Test Users & Dev Auth

Enable dev auth in `.env`:

```bash
DEV_AUTH_ENABLED=true
DEV_AUTH_PASSWORD=password123
```

Test accounts (all passwords: `password123`):

| Role  | Email                           | Household           |
| ----- | ------------------------------- | ------------------- |
| Admin | admin@family-picnic.example.com | —                   |
| User  | maria.garcia@example.com        | The Garcia Family   |
| User  | carlos.garcia@example.com       | The Garcia Family   |
| User  | lisa.thompson@example.com       | The Thompson Family |
| User  | bob.thompson@example.com        | The Thompson Family |
| User  | priya.patel@example.com         | The Patel Family    |

**Login flow:** Go to `/login`, enter email + `password123`.

Seeding resets data — run `npm run db:seed` after `db:push` or `db:migrate`.

## Commit Messages

**Always validate with `commit-message-lint` skill before committing.** Format: `type(scope): subject`

| Rule                | Limit                      |
| ------------------- | -------------------------- |
| `header-max-length` | ≤ 100 characters           |
| `subject-case`      | imperative mood, lowercase |
| `subject-full-stop` | no trailing `.`            |

Examples: `fix(rsvp): release potluck slots on decline`, `feat(auth): add dev credentials`

Validate:

```bash
printf '%s' "fix(rsvp): release potluck slots on decline" | npx commitlint
```

If rejected, fix the message and use `git commit --amend` — do NOT use `--no-verify`.

## Full Documentation

For complete documentation on:

- Project context and domain model → `docs/agents/CONTEXT.md`
- All commands and scripts → `docs/agents/COMMANDS.md`
- Code conventions and rules → `docs/agents/CONVENTIONS.md`
- Testing strategy → `docs/agents/TESTING.md`
- Route structure → `docs/agents/ROUTING.md`
- tRPC router reference → `docs/agents/TRPC.md`
- Security model → `docs/agents/SECURITY.md`
- Quick reference → `docs/QUICKREF.md`

## Route Map (Summary)

### Public Routes

`/`, `/login`, `/events`, `/events/[id]`, `/events/calendar`, `/potluck`, `/photos`, `/my-events`

### Authenticated Routes

`/profile`, `/household`, `/household/tree`, `/onboarding`

### Admin Routes

`/admin/dashboard`, `/admin/events`, `/admin/events/new`, `/admin/events/[id]/edit`, `/admin/events/[id]/edit/admins`, `/admin/invitations`, `/admin/communications`, `/admin/audit-log`

## What NOT to Edit

1. **`src/app/api/auth/[...nextauth]/route.ts`** — NextAuth handler is the single source of truth for auth.
2. **`src/lib/auth.ts`** — Only exports `authOptions` and `getServerSession`.
3. **`prisma/schema.prisma`** — If modified, run `npm run db:generate`. Client generated to `src/lib/generated/client`.
4. **`src/lib/generated/`** — Prisma-generated code. Do not edit manually.
5. **`public/sw.js`** — Service worker has known ESLint `no-undef` errors for browser globals. Safe to ignore.

## Known ESLint Issues (Safe to Ignore)

| File                    | Errors                          | Reason                                    |
| ----------------------- | ------------------------------- | ----------------------------------------- |
| `public/sw.js`          | 23x `no-undef`                  | Browser globals not in Node ESLint config |
| `sw.js`                 | 1x `no-undef`, 1x `unused-vars` | Browser-only code                         |
| `InvitationsClient.tsx` | React 19 lint warnings          | React 19 specific                         |
| `HouseholdClient.tsx`   | 2x `unused-vars`                | Two unused variables                      |
| `HelpButton.tsx`        | 1x `set-state-in-effect`        | React 19 lint warning                     |

## Tickets

All tickets in `tickets/` directory. See `tickets/README.md` for priority order.

Completed tickets are tracked in `docs/agents/TESTING.md`.
