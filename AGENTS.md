# AGENTS.md

Developer guide for the Family Picnic Platform codebase. Full documentation is in `docs/agents/`.

## Quick Commands

### Development

```bash
bun run dev          # Start Next.js dev server on localhost:3000
bun run build        # Production build
bun run start        # Start production server (requires build first)
```

### Testing & Quality

```bash
bun test             # Run all tests (Vitest)
bun run test:watch   # Watch mode for development
bun run test:coverage # Coverage report

bun run lint         # ESLint
bun run typecheck    # TypeScript type checking
bun run ci           # Full CI suite: typecheck + lint + format:check + test:coverage
```

### Local CI (wrkflw)

The pre-commit hook validates the CI YAML with `wrkflw` then runs `bun run ci` locally.
Install wrkflw for local CI validation:

```bash
cargo install wrkflw
```

Manual validation: `wrkflw validate .github/workflows/ci.yml`

### Code Formatting

```bash
bun run format       # Format all files with Prettier
bun run format:check # Check formatting without modifying
```

### Database

```bash
bun run db:generate  # Generate Prisma client after schema changes
bun run db:push      # Push schema to database (dev)
bun run db:migrate   # Run migrations (creates revision history)
bun run db:seed      # Seed database with sample data
bun run db:studio    # Open Prisma Studio (GUI)
bun run db:validate  # Validate Prisma schema
```

### One-Command Dev Setup

```bash
bash scripts/dev.sh
```

### E2E Testing

```bash
bun run test:e2e          # Run Playwright e2e tests
bun run test:e2e -- --ui   # Run with Playwright UI
```

Setup for first run:

```bash
bun run db:push            # Push schema
bun run db:seed            # Seed test users
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

Seeding resets data — run `bun run db:seed` after `db:push` or `db:migrate`.

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

| Route                            | File                                             | Description                        |
| -------------------------------- | ------------------------------------------------ | ---------------------------------- |
| `/admin/dashboard`               | `src/app/admin/dashboard/page.tsx`               | Admin overview metrics             |
| `/admin/events`                  | `src/app/admin/events/page.tsx`                  | Event management list              |
| `/admin/events/new`              | `src/app/admin/events/new/page.tsx`              | Create event                       |
| `/admin/events/[id]/edit`        | `src/app/admin/events/[id]/edit/page.tsx`        | Edit event & potluck slots         |
| `/admin/events/[id]/edit/admins` | `src/app/admin/events/[id]/edit/admins/page.tsx` | Event admin management             |
| `/admin/invitations`             | `src/app/admin/invitations/page.tsx`             | Invitation management + CSV import |
| `/admin/communications`          | `src/app/admin/communications/page.tsx`          | Broadcast composer                 |
| `/admin/audit-log`               | `src/app/admin/audit-log/page.tsx`               | Audit log viewer                   |

### API Routes

| Route                                         | File                                                          | Description                                    |
| --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `/api/auth/[...nextauth]`                     | `src/app/api/auth/[...nextauth]/route.ts`                     | NextAuth handler                               |
| `/api/rsvp`                                   | `src/app/api/rsvp/route.ts`                                   | RSVP create/update/decline                     |
| `/api/potluck-signup`                         | `src/app/api/potluck-signup/route.ts`                         | Potluck slot signup                            |
| `/api/dependents`                             | `src/app/api/dependents/route.ts`                             | Dependent CRUD                                 |
| `/api/profile`                                | `src/app/api/profile/route.ts`                                | Profile preferences                            |
| `/api/photo-reaction`                         | `src/app/api/photo-reaction/route.ts`                         | Photo reactions                                |
| `/api/photo-upload-url`                       | `src/app/api/photo-upload-url/route.ts`                       | S3 presigned URL generation                    |
| `/api/photos`                                 | `src/app/api/photos/route.ts`                                 | Photo record CRUD                              |
| `/api/trpc/[trpc]`                            | `src/app/api/trpc/[trpc]/route.ts`                            | tRPC API handler                               |
| `/api/admin/events`                           | `src/app/api/admin/events/route.ts`                           | Admin event CRUD                               |
| `/api/admin/events/[id]`                      | `src/app/api/admin/events/[id]/route.ts`                      | Admin single event operations                  |
| `/api/admin/events/[id]/publish`              | `src/app/api/admin/events/[id]/publish/route.ts`              | Publish event                                  |
| `/api/admin/events/[id]/close`                | `src/app/api/admin/events/[id]/close/route.ts`                | Close event                                    |
| `/api/admin/events/[id]/cancel`               | `src/app/api/admin/events/[id]/cancel/route.ts`               | Cancel event                                   |
| `/api/admin/events/[id]/admins`               | `src/app/api/admin/events/[id]/admins/route.ts`               | Event admin management                         |
| `/api/admin/potluck-slots`                    | `src/app/api/admin/potluck-slots/route.ts`                    | Create potluck slots                           |
| `/api/admin/potluck-slots/[id]`               | `src/app/api/admin/potluck-slots/[id]/route.ts`               | Update/delete potluck slots                    |
| `/api/admin/invitations/send`                 | `src/app/api/admin/invitations/send/route.ts`                 | Send invitations                               |
| `/api/admin/invitations/resend`               | `src/app/api/admin/invitations/resend/route.ts`               | Resend invitations                             |
| `/api/admin/invitations/track`                | `src/app/api/admin/invitations/track/route.ts`                | Track invitation delivery                      |
| `/api/admin/communications/send`              | `src/app/api/admin/communications/send/route.ts`              | Send broadcast (immediate or scheduled)        |
| `/api/admin/communications/status`            | `src/app/api/admin/communications/status/route.ts`            | Broadcast status                               |
| `/api/admin/communications/process-scheduled` | `src/app/api/admin/communications/process-scheduled/route.ts` | Process due scheduled broadcasts (cron target) |
| `/api/admin/audit-log`                        | `src/app/api/admin/audit-log/route.ts`                        | Audit log queries                              |
| `/api/admin/csv-import`                       | `src/app/api/admin/csv-import/route.ts`                       | Bulk CSV import                                |
| `/api/admin/users/search`                     | `src/app/api/admin/users/search/route.ts`                     | Search users by email                          |
| `/api/onboarding/household`                   | `src/app/api/onboarding/household/route.ts`                   | Onboarding household setup                     |
| `/api/onboarding/dependent`                   | `src/app/api/onboarding/dependent/route.ts`                   | Onboarding dependent creation                  |
| `/api/onboarding/complete`                    | `src/app/api/onboarding/complete/route.ts`                    | Complete onboarding                            |

## tRPC Router Structure

Routers are located in `src/server/routers/`:

| Router          | File                      | Procedures                                                                                    |
| --------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `auth`          | `auth.router.ts`          | session, signIn, signOut, callback                                                            |
| `user`          | `user.router.ts`          | me, update, updatePreferences, completeOnboarding, linkHousehold                              |
| `household`     | `household.router.ts`     | create, get, getById, update, addMember, removeMember, getCumulativeHeadcount                 |
| `dependent`     | `dependent.router.ts`     | create, update, remove, list                                                                  |
| `event`         | `event.router.ts`         | create, list, getById, update, listAdmins, addAdmin, removeAdmin                              |
| `invitation`    | `invitation.router.ts`    | create, send, resend, track, consume                                                          |
| `rsvp`          | `rsvp.router.ts`          | confirm, decline, update, getByEvent, getMyRsvp, getHeadcount                                 |
| `potluck`       | `potluck.router.ts`       | listSlots, signup, updateSignup, cancelSignup, getFoodSummary                                 |
| `photo`         | `photo.router.ts`         | getUploadUrl, confirmUpload, search, delete, addReaction, removeReaction                      |
| `communication` | `communication.router.ts` | sendInvite, sendRsvpReminder, sendBroadcast, scheduleMessage, unsubscribe, getRateLimitStatus |
| `admin`         | `admin.router.ts`         | getUsers, getAuditLog, dashboard, csvImport, getDietarySummary                                |

### tRPC Procedures

Three procedure types are used:

```typescript
procedure; // Public - no auth required
protectedProcedure; // Requires authenticated session
adminProcedure; // Requires ADMIN role
auditedAdminProcedure; // Admin + writes to AdminAuditLog
```

### tRPC Middleware Chain

```typescript
protectedProcedure = procedure.use(isAuthenticated);
adminProcedure = procedure.use(isAuthenticated).use(isAdmin);
auditedAdminProcedure = procedure.use(isAuthenticated).use(isAdmin).use(auditLog);
```

The `isAuthenticated` and `isAdmin` middleware narrow `ctx.session` from `Session | null` to `Session`. The `auditLog` middleware writes entries to `AdminAuditLog` for all mutations.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin pages (protected)
│   ├── api/               # API routes (REST + tRPC)
│   ├── events/           # Events pages
│   ├── household/         # Household pages
│   └── ...
├── components/
│   ├── ui/               # UI primitives (Button, Input, Card, Modal, Toast, etc.)
│   ├── admin/            # Admin-specific components
│   ├── event/            # Event components (Calendar, RSVPForm, etc.)
│   ├── household/        # Household components (FamilyTree, etc.)
│   ├── communication/    # Communication components
│   ├── photos/           # Photo components
│   └── onboarding/       # Onboarding components
├── hooks/                # React hooks (useOffline, useEvent, usePotluck, useHousehold)
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   ├── trpc.ts         # tRPC initialization and middleware
│   ├── trpc-client.ts  # tRPC client for React
│   ├── schemas/        # Zod validation schemas
│   ├── audit.ts        # Audit logging utilities
│   ├── s3.ts           # S3 presigned URL generation
│   ├── exif-stripper.ts # Client-side EXIF removal
│   ├── photo-prism.ts  # PhotoPrism integration
│   ├── twilio.ts       # Twilio SMS wrapper
│   ├── sendgrid.ts     # SendGrid email wrapper
│   ├── rate-limit.ts   # Rate limiting helpers
│   ├── csv-parser.ts   # CSV parsing utilities
│   ├── constants.ts    # Shared constants
│   └── invitation-token.ts # Invitation token utilities
└── server/
    └── routers/         # tRPC routers
```

## What NOT to Edit

1. **`src/app/api/auth/[...nextauth]/route.ts`** — NextAuth handler is the single source of truth for auth.
2. **`src/lib/auth.ts`** — Only exports `authOptions` and `getServerSession`.
3. **`prisma/schema.prisma`** — If modified, run `bun run db:generate`. Client generated to `src/lib/generated/client`.
4. **`src/lib/generated/`** — Prisma-generated code. Do not edit manually.

## Tickets

All tickets in `tickets/` directory. See `tickets/README.md` for priority order.

### Completed Tickets (MVP Scope)

| Ticket | Description                       | Iteration |
| ------ | --------------------------------- | --------- |
| 01     | tRPC router structure             | 1         |
| 14     | Resolve open questions (ADRs)     | 2         |
| 08     | Admin event CRUD                  | 3         |
| 06     | Household dashboard               | 5         |
| 28     | Potluck slot race condition fix   | 6         |
| 07     | Household tree visualization      | 7         |
| 09     | Potluck slot management UI        | 9         |
| 02     | Admin dashboard page              | 10        |
| 42     | Auto-release potluck on decline   | 11        |
| 36     | Remove duplicate NextAuth handler | 12        |
| 05     | Admin audit log page              | 13, 29    |
| 15     | UI primitives library             | 14        |
| 41     | Invitation single-use tokens      | 15        |
| 03     | Admin invitations page            | 16        |
| 04     | Admin communications page         | 17        |
| 16     | React hooks layer                 | 18, 24    |
| 37     | Realistic seed data               | 19        |
| 17     | Integration test coverage         | 20        |
| 11     | Photo deletion policy             | 20        |
| 10     | Photo upload flow                 | 21        |
| 12     | PWA offline support               | 22        |
| 23     | Events calendar view              | 25        |
| 22     | Dietary label filtering           | 28        |
| 18     | Audit log middleware              | 29        |
| 21     | First-time onboarding wizard      | 30        |
| 19     | CSV bulk import                   | 31        |
| 20     | Multi-admin per event             | 32        |
| 29     | RSVP waitlist                     | 33        |
| 24     | Photo search                      | 34        |
| 27     | Zod schemas and validation        | 35        |
| 33     | Loading and error states          | 36        |
| 34     | Type safety hardening             | 37        |
| 25     | Rate limiting for broadcasts      | 38        |

### Remaining Tickets (Post-MVP / Infrastructure)

| Ticket | Description                              | Status                                    |
| ------ | ---------------------------------------- | ----------------------------------------- |
| 13     | Kubernetes manifests                     | Done                                      |
| 26     | Empty route shells cleanup               | Done (route groups removed, docs in arch) |
| 30     | Account recovery                         | Won't do (see ADR-001)                    |
| 31     | Scheduled broadcasts                     | Done (round 3)                            |
| 38     | Accessibility audit                      | Done                                      |
| 39     | Observability (logging, metrics, Sentry) | Done                                      |
| 40     | Backup and data export                   | Done (round 3)                            |
| 35     | Changelog and commit hygiene             | Done                                      |

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

| Variable             | Description                                 | Required            |
| -------------------- | ------------------------------------------- | ------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                | Yes                 |
| `NEXTAUTH_URL`       | App URL (http://localhost:3000 for dev)     | Yes                 |
| `NEXTAUTH_SECRET`    | Random string for session encryption        | Yes                 |
| `AUTH_GOOGLE_ID`     | Google OAuth client ID                      | Yes                 |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret                  | Yes                 |
| `TWILIO_*`           | Twilio SMS credentials                      | For SMS             |
| `SENDGRID_*`         | SendGrid email credentials                  | For email           |
| `S3_*`               | S3-compatible storage                       | For photo uploads   |
| `CRON_SECRET`        | Secret for authenticating cron job requests | For scheduled tasks |

## Prisma

After modifying `prisma/schema.prisma`, always run:

```bash
bun run db:generate  # Regenerate Prisma client
bun run db:push      # Push changes to dev database
```

The Prisma client is generated to `src/lib/generated/client` (not the default `@prisma/client` location).
