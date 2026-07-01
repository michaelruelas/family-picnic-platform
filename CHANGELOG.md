# Changelog

All notable changes to this project are documented here.

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
