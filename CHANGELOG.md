# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- **Admin Invitations Page** — Implemented `/admin/invitations` page with event selector dropdown, household search, invitation table showing status (PENDING/SENT/DELIVERED/USED/EXPIRED), and send/resend/track actions. Created `InvitationTable` component and `InvitationsClient` client component. API routes: `POST /api/admin/invitations/send`, `POST /api/admin/invitations/resend`, `POST /api/admin/invitations/track`. Invitation send/resend now emits `CommunicationLog` entries for each recipient. Added `sentAt` field to `Invitation` model in Prisma schema to track delivery timestamps.
- **Unsubscribe Communication Logging** — Updated `communication.unsubscribe` to emit `CommunicationLog` entry with `UNSUBSCRIBED` status when user unsubscribes from a channel.
- **Invitation Single-Use Tokens** — Implemented single-use invitation tokens per SPEC §8.5. Added `token` (UUID v7) and `expiresAt` (30 days) fields to `Invitation` model. Extended `InvitationStatus` enum with `USED` and `EXPIRED` values. Added `consume` procedure to invitation router that validates token, checks expiry, and marks as USED. RSVP create/confirm now automatically mark pending invitations as USED. Error messages: "This invitation has already been used" and "This invitation has expired".
- **UI Primitives Library** — Created `src/components/ui/` with Button (primary/secondary/danger/ghost variants, lg/xl sizes for touch), Input, Textarea, Select (large fonts, high contrast), Card (with CardHeader/CardTitle/CardContent/CardFooter), Modal (focus trap, escape-to-close, React portal), Toast (success/error/warning/info with auto-dismiss), EmptyState, and Spinner. All components use Tailwind tokens (text-lg, min-h-12) sized for multi-generational accessibility. Tests at `tests/ui/primitives.test.ts`.
- **Admin Audit Log UI** — Implemented `/admin/audit-log` page with filterable table showing all AdminAuditLog entries, filters by eventId/userId/action, and JSON diff viewer for oldValue/newValue. Created `AuditLogTable` component and `/api/admin/audit-log` API route. Ticket 05 is Partial - automatic audit logging via middleware is blocked (see ticket 18).
- **Audit helper** — Created `src/lib/audit.ts` with `diff()` helper and `writeAuditLog()` function for manual audit logging. Ticket 18 Blocked - TypeScript typing issues prevent adding audit middleware to adminProcedure chain without breaking session null-check narrowing.
- **Architecture Decision Records** — Created `docs/decisions/` with 10 ADRs resolving SPEC §10 open questions (Q1, Q3, Q4, Q6, Q7, Q8, Q9, Q11, Q12, Q15): account recovery, household naming, household merging, headcount minimum, waitlist, RSVP closing, duplicate dishes, EXIF stripping, storage quotas, and communication opt-in defaults.
- **Admin Event CRUD UI** — Implemented `/admin/events` list page, `/admin/events/new` create page, `/admin/events/[id]/edit` page with `EventForm` and `EventStatusBadge` components. Includes API routes for create, update, delete, publish, close, and cancel with admin role protection and EventStatus transition enforcement.
- **Household Dashboard** — Implemented `/household` page with household member list, cumulative RSVP headcount aggregation across events (SPEC §8.1), and dependent management form. Added `getCumulativeHeadcount` procedure to household router.
- **Household Tree Visualization** — Implemented `/household/tree` page with interactive tree visualization showing nested household hierarchy. Uses recursive `FamilyTree` component with expand/collapse, member details view, color-coded member types (adults/children/dependents), and mobile-friendly layout.
- **Admin Potluck Slot Management** — Implemented potluck slot management UI in `/admin/events/[id]/edit` page with `SlotForm` and `SlotGrid` components. Admins can add, edit, and delete potluck slots with category, name, slot type (LIMITED/UNLIMITED), and max signups. API routes: `POST /api/admin/potluck-slots`, `PATCH/DELETE /api/admin/potluck-slots/[id]`. Slot deletion cascades to signups via Prisma `onDelete: Cascade`.
- **Admin Dashboard** — Implemented `/admin/dashboard` page showing all events with aggregated RSVP metrics (confirmed/pending/declined headcount), capacity utilization, and potluck food summary. Includes `DashboardCard` component and links to other admin pages (Events, Invitations, Communications, Audit Log).

### Fixed

- **Potluck slot race condition** — Fixed race condition in `src/app/api/potluck-signup/route.ts` by wrapping signup + counter increment in `prisma.$transaction` with `isolationLevel: Serializable`. The count check, signup create/update, and counter increment now happen atomically. Returns 409 Conflict when slot is full instead of allowing over-signup.
- **Auto-release potluck slots on RSVP decline** — When an RSVP is declined, potluck signups are now automatically released. The implementation in `src/app/api/rsvp/route.ts` decrements `PotluckSlot.currentSignups` by the signup's servings count, deletes all `PotluckSignup` rows tied to the RSVP, updates the RSVP to DECLINED status with headcount 0, and writes an audit log entry with `POTLUCK_SLOT_RELEASE` action — all within a single transaction for atomicity.
- **Remove duplicate NextAuth handler** — Removed duplicate `GET`/`POST` handler exports from `src/lib/auth.ts`. The active handler lives in `src/app/api/auth/[...nextauth]/route.ts` which imports `authOptions` from lib. The lib now only exports `authOptions` and `getServerSession`.

## [0.1.0] — 2026-07-01

### Added

- **Prisma schema** — 13 models, 14 enums, full relation graph aligned with SPEC.md
- **Project scaffold** — Next.js 16 (App Router), tRPC v11, Prisma 7, NextAuth 4, Tailwind CSS 4, TypeScript 6
- **Auth module** — Google OAuth via NextAuth, session enrichment with role and householdId
- **tRPC middleware** — `protectedProcedure` (authenticated) and `adminProcedure` (admin-only) with structured error formatting
- **Prisma client** — Singleton with `@prisma/adapter-pg`, dev-query logging, global caching
- **Test suite** — Vitest with 21 tests across unit, integration, and schema-integrity specs
- **CI pipeline** — GitHub Actions: typecheck, lint, format, test, prisma validate, build
- **Tooling** — ESLint (Next.js config), Prettier (with Tailwind plugin), `.env.example`, `.gitignore`

### Fixed

- Aligned all enum values with SPEC (Role, InvitationStatus, CommunicationStatus, ReactionType)
- Renamed `Event.details` → `description`
- Added missing `RSVP.householdId`, `RSVP.dietaryNotes`
- Added missing `Photo.photoPrismId`, `Photo.caption`
- Added missing `CommunicationLog.messageId`
- Restructured `PotluckSignup` to reference RSVP (not User/Household directly)
- Upgraded to Prisma 7 driver-adapter pattern (`prisma.config.ts`, `@prisma/adapter-pg`)
- Removed deprecated `dependentSlots` relation and ReactionType enum
