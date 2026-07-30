# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [0.1.12] — 2026-07-30

### Fixed

- **Google OAuth admin signups blocked from admin pages (#16)** — Google signups land with role `admin_adult` (the schema default), but every admin gate checked `role !== 'admin'` and silently redirected to `/`. Promoted admins signing in via Google were locked out of the admin dashboard. Introduced `isAdminRole` helper and `ADMIN_ROLES` set in `src/lib/auth.ts`; switched tRPC `isAdmin` middleware, all 7 admin pages, 18 admin API routes, photo-delete, and the photo router to use it. Added a `jwt` callback to stamp the local Prisma user id into `token.sub` so the `session` callback's Prisma lookup resolves Google users. Audit-log user filter now matches against `ADMIN_ROLES` so `admin_adult` users appear in the picker.

### Refactoring

- **`requireAdmin` helper extraction (#17)** — Pulled the `session.user.role ∈ ADMIN_ROLES` check into `src/lib/admin-auth.ts` so admin gating is a single import across pages, route handlers, and tRPC procedures.

## [0.1.0] — 2026-07-02

### Added

- **Prisma schema** — 13 models, 14 enums, full relation graph aligned with SPEC.md
- **Project scaffold** — Next.js 16 (App Router), tRPC v11, Prisma 7, NextAuth 4, Tailwind CSS 4, TypeScript 6
- **Auth module** — Google OAuth via NextAuth, session enrichment with role and householdId
- **tRPC middleware** — `protectedProcedure` (authenticated) and `adminProcedure` (admin-only) with structured error formatting
- **Prisma client** — Singleton with `@prisma/adapter-pg`, dev-query logging, global caching
- **Test suite** — Vitest with 21 tests across unit, integration, and schema-integrity specs
- **CI pipeline** — GitHub Actions: typecheck, lint, format, test, prisma validate, build
- **Tooling** — ESLint (Next.js config), Prettier (with Tailwind plugin), `.env.example`, `.gitignore`
- **Complete MVP implementation (`790dfc4`)** — Full feature set landed in a single commit on 2026-07-02. The items below were all part of that MVP commit and shipped with v0.1.0:
  - **Observability Infrastructure (Ticket 39)** — Structured logging with pino (`src/lib/logger.ts`) with request-scoped loggers, JSON output, and requestId/userId/route correlation. `src/lib/tracing.ts` provides AsyncLocalStorage trace context. LOG_LEVEL, SENTRY_DSN, and OTEL_EXPORTER_OTLP_ENDPOINT added to `.env.example`. Key API routes instrumented: `/api/rsvp`, `/api/potluck-signup`, `/api/profile`, `/api/admin/events`, `/api/admin/communications/send`.
  - **Kubernetes Manifests (Ticket 13)** — `kubernetes/` with base manifests for Next.js, PostgreSQL (3-replica StatefulSet), and PhotoPrism (50TB PVC, egress-restricted NetworkPolicy). Kustomize dev overlay at `kubernetes/overlays/dev/`. Deployment docs in `kubernetes/README.md`.
  - **Accessibility Audit (Ticket 38)** — Toast `aria-live`/`aria-atomic` per WCAG. `tests/a11y/` with 29 tests covering Toast, Modal, UI primitives keyboard nav, and 4.5:1 color contrast on all primary text.
  - **Commit Hygiene and Release Please (Ticket 35)** — Conventional commit enforcement via commitlint + husky. `release-please` config and `release:dry`/`release:full` scripts.
  - **Dev Onramp and AGENTS.md (Tickets 43, 32)** — `AGENTS.md` developer guide, `scripts/dev.sh` one-command setup, `docker-compose.yml` for local PostgreSQL.
  - **Rate Limiting for Broadcasts and Invitations (Ticket 25)** — `src/lib/rate-limit.ts` with admin (5/hr), recipient group (1/30min), and per-recipient (2/day) limits. Wired into `sendBroadcast` and `invitation.send`.
  - **Type Safety Hardening (Ticket 34)** — Replaced loose `string` types with Prisma enums in RSVPForm, PotluckSignupForm, ProfileClient, and `RELATIONSHIP_LABELS`.
  - **Loading Skeletons (Ticket 33)** — Pulse-animated placeholders at `/events/loading.tsx` and `/my-events/loading.tsx`. Root `error.tsx` for friendly error UI.
  - **Zod Schemas and Validation (Ticket 27)** — Shared schemas in `src/lib/schemas/` for rsvp, potluck, dependent, profile, photo. 30 schema tests.
  - **RSVP Waitlist (Ticket 29)** — `WAITLISTED` enum, `waitlistPosition` field, waitlist UI in `RSVPForm`. See ADR-005.
  - **Multi-Admin Per Event (Ticket 20)** — `EventAdmin` join table, `listAdmins`/`addAdmin`/`removeAdmin` procedures, `/admin/events/[id]/edit/admins` page.
  - **Admin Bulk CSV Import (Ticket 19)** — PapaParse-based `src/lib/csv-parser.ts` and `CsvUploader` component with drag-and-drop, preview, and dry-run.
  - **First-Time Onboarding Wizard (Ticket 21)** — `/onboarding` 3-step wizard (household, family members, comm preference) with `WizardStep` and `HelpButton` components.
  - **Audit Middleware (Tickets 18, 05)** — `auditLog` middleware writes `AdminAuditLog` entries. `auditedAdminProcedure` exported for admin mutations.
  - **Dietary Label Filtering (Ticket 22)** — `DietaryLabelChip`, `DietaryFilter`, `DietaryAttendeeFilter` components on event detail and admin dashboard.
  - **Events Calendar View (Ticket 23)** — `/events/calendar` month grid with `Calendar` component.
  - **Component Hook Migration (Ticket 16)** — `useRsvp`, `useUser`, `usePhoto` hooks. `TRPCProvider` for tRPC + React Query.
  - **PWA Offline Support (Ticket 12)** — `public/manifest.webmanifest` and `public/sw.js`. `OfflineBanner` component.
  - **Photo Upload Flow (Ticket 10)** — S3 presigned URLs, client-side EXIF stripping, PhotoPrism sync. `UploadButton` and `PhotoGrid` components.
  - **Integration Test Coverage (Ticket 17)** — 136 tests across 13 files covering all six SPEC §8 edge cases.
  - **Photo Deletion Policy (Ticket 11)** — Soft-delete via `deletedAt`, all deletions audited.
  - **Realistic Seed Data (Ticket 37)** — `prisma/seed.ts` extended with household, users, dependents, event, RSVPs, photos.
  - **Admin Communications Page (Ticket 04)** — `/admin/communications` broadcast composer with Twilio and SendGrid wrappers.
  - **Admin Invitations Page (Ticket 03)** — `/admin/invitations` with event selector, send/resend/track actions.
  - **Unsubscribe Communication Logging** — `communication.unsubscribe` writes `CommunicationLog` with `UNSUBSCRIBED` status.
  - **Invitation Single-Use Tokens (Ticket 41)** — `consume` procedure enforces one-time use.
  - **UI Primitives Library (Ticket 15)** — `src/components/ui/` with Button, Input, Card, Modal, Toast, EmptyState, Spinner. Tests in `tests/ui/primitives.test.ts`.
  - **Admin Audit Log UI (Tickets 05, 18)** — `/admin/audit-log` filterable table with JSON diff viewer.
  - **Audit helper** — `src/lib/audit.ts` with `diff()` and `writeAuditLog()`.
  - **Architecture Decision Records (Ticket 14)** — 10 ADRs in `docs/decisions/`.
  - **Admin Event CRUD UI (Ticket 08)** — `/admin/events` list, create, and edit pages.
  - **Household Dashboard (Ticket 06)** — `/household` member list with cumulative headcount.
  - **Household Tree Visualization (Ticket 07)** — `/household/tree` interactive family tree.
  - **Admin Potluck Slot Management (Ticket 09)** — Slot management UI in `/admin/events/[id]/edit`.
  - **Admin Dashboard (Ticket 02)** — `/admin/dashboard` aggregated RSVP metrics.
  - **Empty Route Shells Cleanup (Ticket 26)** — Documented flat `/events/[id]/*` layout in `docs/architecture.md`. Removed scaffolded empty route groups.

### Fixed

- Aligned all enum values with SPEC (Role, InvitationStatus, CommunicationStatus, ReactionType)
- Renamed `Event.details` → `description`
- Added missing `RSVP.householdId`, `RSVP.dietaryNotes`
- Added missing `Photo.photoPrismId`, `Photo.caption`
- Added missing `CommunicationLog.messageId`
- Restructured `PotluckSignup` to reference RSVP (not User/Household directly)
- Upgraded to Prisma 7 driver-adapter pattern (`prisma.config.ts`, `@prisma/adapter-pg`)
- Removed deprecated `dependentSlots` relation and ReactionType enum
- **Potluck slot race condition (Ticket 28)** — Signup + counter increment wrapped in `prisma.$transaction` with `Serializable` isolation. Returns 409 Conflict on full slot.
- **Auto-release potluck slots on RSVP decline (Ticket 42)** — On decline, potluck signups released and `PotluckSlot.currentSignups` decremented atomically.
- **Remove duplicate NextAuth handler (Ticket 36)** — Removed duplicate handler exports from `src/lib/auth.ts`. Single active handler in `src/app/api/auth/[...nextauth]/route.ts`.

## [0.1.11] — 2026-07-27

### Added

- **Renovate replaces Dependabot** — Self-hosted [Renovate](https://docs.renovatebot.com/) bot via `renovatebot/github-action` for weekly dependency updates. `renovate.json` configures the `bun` and `github-actions` managers, groups production and development dependencies separately, and skips major version updates. Weekly Monday morning schedule via `.github/workflows/renovate.yml`. Closes the loop on the dependabot/bun-lockfile conflict — the previous dependabot config updated `package-lock.json` only and could never pass `bun install --frozen-lockfile` in CI.
- **Release-please manifest** — Added `.release-please-manifest.json` and `release-please-config.json` to track the current release version and configure changelog generation from conventional commits.
- **CI test pipeline** — Tests moved from the pre-commit hook to the CI pipeline. Full `bun test` (with coverage gate) now runs on every push; `lint-staged` runs a partial mirror (`vitest run --passWithNoTests`) for staged files. `bun run ci` script added for the full local suite.

### Changed

- **Prisma 7.9.0 → 7.9.1** — Security patch for a transitive dependency advisory in `@prisma/dev` (prisma/prisma#29780). No production behavior change.
- **Next.js 16.2.11 and NextAuth 4.24.15** — Patch upgrades addressing a NextAuth session-handling security advisory and pulling the latest Next.js stable patches.
- **GitHub Actions kept current** — Renovate/Dependabot bumped `actions/*` (5 updates) and production (11) plus development (19) dependency groups.

### Fixed

- **Vulnerable transitive dependencies** — Added npm overrides to force patched versions of `brace-expansion` (1.1.16) and six other packages with open Dependabot security alerts. See commit `2a75818` for the full list.
- **Renovate runner setup** — Switched from Docker-based to `npx renovate` on the self-hosted runner, dropped the unsupported `--config-file` flag, pinned Node 24, and removed the invalid `bunVersion` option. Iterative fixes landed in `eb5d7bc`, `3dd9b5c`, `7f3cb7e`, `c5ef572`.

### Removed

- **`package-lock.json`** — Stale npm lockfile. Project uses `bun.lock` exclusively; `package.json`, `Dockerfile`, and CI all read from `bun.lock`. Regenerate with `bun install` if needed.
- **`.github/dependabot.yml`** — Replaced by Renovate (see above).

## [0.1.10] — 2026-07-26

### Fixed

- **Docker buildx for Node 24** — Upgraded `setup-buildx-action` from v3 to v4 to restore Docker image builds under the Node 24 CI runtime. Removed the invalid `driver-opt: name=name` flag that v4 rejects. See commits `7631897` and `addb679`.
