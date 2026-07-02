# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- **tRPC router structure** — Implemented all 10 routers from SPEC §5 (`auth`, `household`, `user`, `event`, `invitation`, `rsvp`, `potluck`, `photo`, `communication`, `admin`) with procedures for all CRUD operations and business logic. The `appRouter` is fully wired up and type-safe.
- **Architecture Decision Records** — Created `docs/decisions/` with 10 ADRs resolving SPEC §10 open questions (Q1, Q3, Q4, Q6, Q7, Q8, Q9, Q11, Q12, Q15): account recovery, household naming, household merging, headcount minimum, waitlist, RSVP closing, duplicate dishes, EXIF stripping, storage quotas, and communication opt-in defaults.
- **Admin Event CRUD UI** — Implemented `/admin/events` list page, `/admin/events/new` create page, `/admin/events/[id]/edit` page with `EventForm` and `EventStatusBadge` components. Includes API routes for create, update, delete, publish, close, and cancel with admin role protection and EventStatus transition enforcement.

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
