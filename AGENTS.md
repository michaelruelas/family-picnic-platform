# AGENTS.md

Developer guide for the Family Picnic Platform codebase. This file helps AI agents and new contributors understand the project structure, conventions, and how to work effectively with the codebase.

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

npm run lint         # ESLint (25 errors, 17 warnings as of 2026-07-02)
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

## Route Map

### Public Routes

| Route              | File                               | Description                      |
| ------------------ | ---------------------------------- | -------------------------------- |
| `/`                | `src/app/page.tsx`                 | Home page                        |
| `/login`           | `src/app/login/page.tsx`           | Login page                       |
| `/events`          | `src/app/events/page.tsx`          | Events list                      |
| `/events/[id]`     | `src/app/events/[id]/page.tsx`     | Event detail with RSVP & potluck |
| `/events/calendar` | `src/app/events/calendar/page.tsx` | Calendar view                    |
| `/potluck`         | `src/app/potluck/page.tsx`         | Potluck overview                 |
| `/photos`          | `src/app/photos/page.tsx`          | Photo gallery                    |
| `/my-events`       | `src/app/my-events/page.tsx`       | User's RSVP history              |

### Authenticated Routes

| Route             | File                              | Description                  |
| ----------------- | --------------------------------- | ---------------------------- |
| `/profile`        | `src/app/profile/page.tsx`        | User profile & preferences   |
| `/household`      | `src/app/household/page.tsx`      | Household dashboard          |
| `/household/tree` | `src/app/household/tree/page.tsx` | Family tree visualization    |
| `/onboarding`     | `src/app/onboarding/page.tsx`     | First-time onboarding wizard |

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

| Route                              | File                                               | Description                   |
| ---------------------------------- | -------------------------------------------------- | ----------------------------- |
| `/api/auth/[...nextauth]`          | `src/app/api/auth/[...nextauth]/route.ts`          | NextAuth handler              |
| `/api/rsvp`                        | `src/app/api/rsvp/route.ts`                        | RSVP create/update/decline    |
| `/api/potluck-signup`              | `src/app/api/potluck-signup/route.ts`              | Potluck slot signup           |
| `/api/dependents`                  | `src/app/api/dependents/route.ts`                  | Dependent CRUD                |
| `/api/profile`                     | `src/app/api/profile/route.ts`                     | Profile preferences           |
| `/api/photo-reaction`              | `src/app/api/photo-reaction/route.ts`              | Photo reactions               |
| `/api/photo-upload-url`            | `src/app/api/photo-upload-url/route.ts`            | S3 presigned URL generation   |
| `/api/photos`                      | `src/app/api/photos/route.ts`                      | Photo record CRUD             |
| `/api/trpc/[trpc]`                 | `src/app/api/trpc/[trpc]/route.ts`                 | tRPC API handler              |
| `/api/admin/events`                | `src/app/api/admin/events/route.ts`                | Admin event CRUD              |
| `/api/admin/events/[id]`           | `src/app/api/admin/events/[id]/route.ts`           | Admin single event operations |
| `/api/admin/events/[id]/publish`   | `src/app/api/admin/events/[id]/publish/route.ts`   | Publish event                 |
| `/api/admin/events/[id]/close`     | `src/app/api/admin/events/[id]/close/route.ts`     | Close event                   |
| `/api/admin/events/[id]/cancel`    | `src/app/api/admin/events/[id]/cancel/route.ts`    | Cancel event                  |
| `/api/admin/events/[id]/admins`    | `src/app/api/admin/events/[id]/admins/route.ts`    | Event admin management        |
| `/api/admin/potluck-slots`         | `src/app/api/admin/potluck-slots/route.ts`         | Create potluck slots          |
| `/api/admin/potluck-slots/[id]`    | `src/app/api/admin/potluck-slots/[id]/route.ts`    | Update/delete potluck slots   |
| `/api/admin/invitations/send`      | `src/app/api/admin/invitations/send/route.ts`      | Send invitations              |
| `/api/admin/invitations/resend`    | `src/app/api/admin/invitations/resend/route.ts`    | Resend invitations            |
| `/api/admin/invitations/track`     | `src/app/api/admin/invitations/track/route.ts`     | Track invitation delivery     |
| `/api/admin/communications/send`   | `src/app/api/admin/communications/send/route.ts`   | Send broadcast                |
| `/api/admin/communications/status` | `src/app/api/admin/communications/status/route.ts` | Broadcast status              |
| `/api/admin/audit-log`             | `src/app/api/admin/audit-log/route.ts`             | Audit log queries             |
| `/api/admin/csv-import`            | `src/app/api/admin/csv-import/route.ts`            | Bulk CSV import               |
| `/api/admin/users/search`          | `src/app/api/admin/users/search/route.ts`          | Search users by email         |
| `/api/onboarding/household`        | `src/app/api/onboarding/household/route.ts`        | Onboarding household setup    |
| `/api/onboarding/dependent`        | `src/app/api/onboarding/dependent/route.ts`        | Onboarding dependent creation |
| `/api/onboarding/complete`         | `src/app/api/onboarding/complete/route.ts`         | Complete onboarding           |

## tRPC Router Structure

Routers are located in `src/server/routers/`:

| Router          | File                      | Procedures                                                                    |
| --------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `auth`          | `auth.router.ts`          | session, signIn, signOut, callback                                            |
| `user`          | `user.router.ts`          | me, update, updatePreferences, completeOnboarding, linkHousehold              |
| `household`     | `household.router.ts`     | create, get, getById, update, addMember, removeMember, getCumulativeHeadcount |
| `dependent`     | `dependent.router.ts`     | create, update, remove, list                                                  |
| `event`         | `event.router.ts`         | create, list, getById, update, listAdmins, addAdmin, removeAdmin              |
| `invitation`    | `invitation.router.ts`    | create, send, resend, track, consume                                          |
| `rsvp`          | `rsvp.router.ts`          | confirm, decline, update, getByEvent, getMyRsvp, getHeadcount                 |
| `potluck`       | `potluck.router.ts`       | listSlots, signup, updateSignup, cancelSignup, getFoodSummary                 |
| `photo`         | `photo.router.ts`         | getUploadUrl, confirmUpload, search, delete, addReaction, removeReaction      |
| `communication` | `communication.router.ts` | sendInvite, sendRsvpReminder, sendBroadcast, unsubscribe, getRateLimitStatus  |
| `admin`         | `admin.router.ts`         | getUsers, getAuditLog, dashboard, csvImport, getDietarySummary                |

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
│   ├── (auth)/            # Auth route group (deprecated - not used)
│   ├── (event)/           # Event route group (deprecated - not used)
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

1. **`src/app/api/auth/[...nextauth]/route.ts`** — The NextAuth handler is the single source of truth for auth. Do not add handler exports elsewhere.

2. **`src/lib/auth.ts`** — Only exports `authOptions` and `getServerSession`. Do not add handler exports.

3. **`prisma/schema.prisma`** — If you modify the schema, you MUST run `npm run db:generate` to regenerate Prisma client types. The generated client is output to `src/lib/generated/client`.

4. **`src/lib/generated/`** — This directory contains Prisma-generated code. Do not edit manually.

5. **`public/sw.js`** — The service worker has known ESLint `no-undef` errors for browser globals (`self`, `caches`, `fetch`). These are expected and safe to ignore.

## Known Issues

### ESLint Errors (Known & Safe to Ignore)

| File                                              | Errors                                     | Reason                                                      |
| ------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `public/sw.js`                                    | 23x `no-undef`                             | Service worker globals not recognized by Node ESLint config |
| `sw.js`                                           | 1x `no-undef`, 1x `unused-vars`            | Browser-only code, globals not in Node scope                |
| `src/app/admin/invitations/InvitationsClient.tsx` | 1x `set-state-in-effect`, 1x `unused-vars` | React 19 lint warning + one unused import                   |
| `src/components/household/HouseholdClient.tsx`    | 2x `unused-vars`                           | Two unused variables                                        |
| `src/components/HelpButton.tsx`                   | 1x `set-state-in-effect`                   | React 19 lint warning                                       |
| Other files                                       | Various `unused-vars`                      | Minor cleanup needed but not blocking                       |

### TypeScript

- tsconfig has `noUncheckedIndexedAccess: true` — array access requires non-null assertion (`arr[0]!`) or explicit check
- Prisma-generated types are in `src/lib/generated/client`

## Tickets

All tickets are in `tickets/` directory, ordered by suggested priority in `tickets/README.md`.

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

| Ticket | Description                              | Status                                      |
| ------ | ---------------------------------------- | ------------------------------------------- |
| 13     | Kubernetes manifests                     | Missing                                     |
| 26     | Empty route shells cleanup               | Partial (route groups removed, docs needed) |
| 30     | Account recovery                         | Missing                                     |
| 31     | Scheduled broadcasts                     | Missing                                     |
| 38     | Accessibility audit                      | Untested                                    |
| 39     | Observability (logging, metrics, Sentry) | Missing                                     |
| 40     | Backup and data export                   | Missing                                     |
| 43     | Dev onramp and AGENTS.md                 | Missing (this file)                         |
| 32     | Repo documentation                       | Missing                                     |
| 35     | Changelog and commit hygiene             | Missing                                     |

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

| Variable             | Description                             | Required          |
| -------------------- | --------------------------------------- | ----------------- |
| `DATABASE_URL`       | PostgreSQL connection string            | Yes               |
| `NEXTAUTH_URL`       | App URL (http://localhost:3000 for dev) | Yes               |
| `NEXTAUTH_SECRET`    | Random string for session encryption    | Yes               |
| `AUTH_GOOGLE_ID`     | Google OAuth client ID                  | Yes               |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret              | Yes               |
| `TWILIO_*`           | Twilio SMS credentials                  | For SMS           |
| `SENDGRID_*`         | SendGrid email credentials              | For email         |
| `S3_*`               | S3-compatible storage                   | For photo uploads |
| `PHOTOPRISM_*`       | PhotoPrism credentials                  | For photo gallery |

## Prisma

After modifying `prisma/schema.prisma`, always run:

```bash
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push changes to dev database
```

The Prisma client is generated to `src/lib/generated/client` (not the default `@prisma/client` location).
