# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- **Observability Infrastructure (Ticket 39)** — Implemented structured logging with pino (`src/lib/logger.ts`) providing request-scoped loggers with JSON output, requestId/userId/route correlation fields. Created `src/lib/tracing.ts` with AsyncLocalStorage for per-request trace context and `runWithTraceContext` helper. Added LOG_LEVEL, SENTRY_DSN, and OTEL_EXPORTER_OTLP_ENDPOINT to `.env.example`. Instrumented key API routes (`/api/rsvp`, `/api/potluck-signup`, `/api/profile`, `/api/admin/events`, `/api/admin/communications/send`) with structured logging replacing console.error calls. Every error log now includes correlation context for debugging.

- **Kubernetes Manifests (Ticket 13)** — Created `kubernetes/` directory with base manifests for Next.js (Deployment, Service, Ingress, HPA, PDB, NetworkPolicy), PostgreSQL (StatefulSet with 3 replicas, headless Service, PVC, Secret), and PhotoPrism (Deployment with 50TB PVC, Service, NetworkPolicy restricting egress). Added Kustomize overlay at `kubernetes/overlays/dev/` for development with reduced resource requests. Included `kubernetes/README.md` with deployment instructions, prerequisites (nginx-ingress, cert-manager), and health check details. Ticket 13 Done.

- **Accessibility Audit (Ticket 38)** — Updated Toast component with `aria-live="polite"` and `aria-atomic="true"` per WCAG accessibility guidelines. Created `tests/a11y/` directory with 29 tests covering Toast ARIA attributes, Modal accessibility, UI primitive keyboard navigation, and WCAG 4.5:1 color contrast verification for all primary text colors (amber-800, green-700, red-700, stone-700 on white). Full axe-core browser testing requires manual verification in a browser environment.

- **Empty Route Shells Cleanup and Route Layout Documentation** — Documented route layout decision in `docs/architecture.md` section 8. Confirmed route groups `(auth)` and `(event)` were not adopted; application uses flat routes under `/events/[id]/*` for event sub-pages. Verified navbar links point to valid routes with no 404s. All previously-scaffolded empty directories have been removed. Ticket 26 Done.

- **Commit Hygiene and Release Please** — Implemented conventional commit discipline with commitlint + husky. Created `.husky/commit-msg` hook that runs commitlint to enforce conventional commits (feat:, fix:, docs:, etc.). Created `commitlint.config.js` extending @commitlint/config-conventional. Added `release-please` package and `release-please-config.json` for changelog auto-generation. Added `release:dry` and `release:full` scripts to package.json. Ticket 35 Done.

- **Dev Onramp and AGENTS.md** — Created `AGENTS.md` at repo root with comprehensive developer guide covering build/test/lint commands, route map, tRPC conventions, what-not-to-touch areas (auth handlers, Prisma schema, generated types), known lint errors, ticket priority table, and environment variables. Created `scripts/dev.sh` one-command dev setup script that starts PostgreSQL via Docker, installs dependencies, generates Prisma client, pushes schema, and starts Next.js dev server. Created `docker-compose.yml` for local PostgreSQL. Updated README.md scripts table with `start` command. Tickets 43 and 32 Done.

- **Rate Limiting for Broadcasts and Invitations** — Implemented per-admin, per-recipient-group, and per-recipient rate limits to prevent spam. Created `src/lib/rate-limit.ts` with `checkAdminBroadcastRateLimit` (5/hour), `checkRecipientGroupRateLimit` (1/30min), `checkAllRecipientRateLimits` (2/day), and `getRateLimitStatus` functions. Added `getRateLimitStatus` query to communication router for admin UI. Updated `sendBroadcast` mutation to enforce all three limits with `TOO_MANY_REQUESTS` errors. Updated `invitation.send` mutation to enforce rate limits. Daily message limit rejects with clear error message showing which recipients are blocked. Ticket 25 Done.

- **Type Safety Hardening** — Replaced loose `string` types with Prisma-generated enums in components: RSVPStatus in RSVPForm, SlotType in PotluckSignupForm, Relationship in ProfileClient Dependent interface, CommunicationPreference in ProfileClient user props, and RELATIONSHIP_LABELS record. tsconfig already had `noUncheckedIndexedAccess: true`. Build passes with strict TypeScript checks. PhotoReactionButton correctly uses string type for emoji reactions per schema comment "reactions are stored as emoji strings". Ticket 34 Done.

- **Loading Skeletons** — Created `/events/loading.tsx` and `/my-events/loading.tsx` with pulse-animated skeleton placeholders matching the layout of each page (event cards, RSVP cards, sections). Root `error.tsx` already provides friendly error UI with "Try Again" and "Go Home" buttons. Ticket 33 Done.

- **Zod Schemas and Validation** — Created shared Zod schemas in `src/lib/schemas/` for rsvp, potluck, dependent, profile, and photo domains. Updated all five API routes to use Zod validation with consistent error codes. Created 30 schema validation tests. Ticket 27 Done.

- **RSVP Waitlist** — Implemented waitlist feature per SPEC §4.1 edge case and ADR-005. Added `WAITLISTED` to `RSVPStatus` enum and `waitlistPosition` field to RSVP model. Updated `confirm` and `decline` procedures for waitlist management. Updated `RSVPForm` with waitlist UI. Ticket 29 Done.

- **Multi-Admin Per Event** — Implemented per-event admin model with `EventAdmin` join table. Added `listAdmins`, `addAdmin`, `removeAdmin` procedures to event router. Created `/admin/events/[id]/edit/admins` page. Ticket 20 Done.

- **Admin Bulk CSV Import** — Implemented bulk CSV import for households and RSVPs. Created `src/lib/csv-parser.ts` with PapaParse. Created `CsvUploader` component with drag-and-drop, parse preview, dry-run mode. Ticket 19 Done.

- **First-Time Onboarding Wizard** — Implemented `/onboarding` page with 3-step wizard (household creation, family members, communication preference). Created `WizardStep` and `HelpButton` components. Ticket 21 Done.

- **Audit Middleware for Admin Procedures** — Fixed TypeScript typing issues. Added `auditLog` middleware that writes `AdminAuditLog` entries. Created `auditedAdminProcedure`. Tickets 18 and 05 now Done.

- **Dietary Label Filtering** — Implemented dietary label filtering on event detail and admin dashboard. Created `DietaryLabelChip`, `DietaryFilter`, and `DietaryAttendeeFilter` components. Ticket 22 Done.

- **Events Calendar View** — Implemented `/events/calendar` page with month grid calendar. Created `Calendar` component with navigation, event chips, mobile-friendly design. Ticket 23 Done.

- **Component Hook Migration Complete** — Migrated all four components from raw fetch to tRPC hooks. Created `useRsvp.ts`, `useUser.ts`, `usePhoto.ts`. All hooks use React Query semantics. Ticket 16 Done.

- **PotluckSignupForm migrated to use tRPC hooks** — Uses `usePotluckSignupMutation` hook with proper loading/error states. Fixed race condition handling for LIMITED slots. Ticket 16 Partial.

- **PWA Offline Support** — Implemented `public/manifest.webmanifest` and `public/sw.js` service worker. Created `OfflineBanner` component. Ticket 12 Done.

- **Photo Upload Flow** — Implemented S3 presigned URLs, client-side EXIF stripping, PhotoPrism sync. Created `UploadButton` and `PhotoGrid` components. Ticket 10 Done.

- **Integration Test Coverage** — Created integration tests for all six SPEC §8 edge cases. 136 tests total across 13 files. Ticket 17 Done.

- **Photo Deletion Policy** — Implemented soft-delete with `deletedAt` field. All deletions logged to audit log. Ticket 11 Done.

- **Realistic Seed Data** — Extended `prisma/seed.ts` with complete test dataset (household, users, dependents, event, RSVPs, photos). Ticket 37 Done.

- **React Hooks Layer** — Implemented tRPC client infrastructure and React Query hooks. Created `TRPCProvider`. Ticket 16 Done.

- **Admin Communications Page** — Implemented `/admin/communications` with broadcast composer, recipient selector, delivery status. Created `twilio.ts` and `sendgrid.ts` wrappers. Ticket 04 Done.

- **Admin Invitations Page** — Implemented `/admin/invitations` with event selector, invitation table, send/resend/track actions. Ticket 03 Done.

- **Unsubscribe Communication Logging** — Updated `communication.unsubscribe` to emit `CommunicationLog` entry with `UNSUBSCRIBED` status.

- **Invitation Single-Use Tokens** — Implemented single-use invitation tokens. Added `consume` procedure to invitation router. Ticket 41 Done.

- **UI Primitives Library** — Created `src/components/ui/` with Button, Input, Card, Modal, Toast, EmptyState, Spinner. Tests at `tests/ui/primitives.test.ts`. Ticket 15 Done.

- **Admin Audit Log UI** — Implemented `/admin/audit-log` page with filterable table and JSON diff viewer. Tickets 05 and 18 Done.

- **Audit helper** — Created `src/lib/audit.ts` with `diff()` helper and `writeAuditLog()` function.

- **Architecture Decision Records** — Created 10 ADRs in `docs/decisions/`. Ticket 14 Done.

- **Admin Event CRUD UI** — Implemented `/admin/events` list, create, and edit pages. Ticket 08 Done.

- **Household Dashboard** — Implemented `/household` page with member list and cumulative headcount. Ticket 06 Done.

- **Household Tree Visualization** — Implemented `/household/tree` page with interactive family tree. Ticket 07 Done.

- **Admin Potluck Slot Management** — Implemented potluck slot management UI in `/admin/events/[id]/edit`. Ticket 09 Done.

- **Admin Dashboard** — Implemented `/admin/dashboard` page with aggregated RSVP metrics. Ticket 02 Done.

### Fixed

- **Potluck slot race condition** — Fixed race condition by wrapping signup + counter increment in `prisma.$transaction` with `Serializable` isolation. Returns 409 Conflict when slot is full. Ticket 28 Done.

- **Auto-release potluck slots on RSVP decline** — When RSVP is declined, potluck signups are released and `PotluckSlot.currentSignups` decremented atomically. Ticket 42 Done.

- **Remove duplicate NextAuth handler** — Removed duplicate handler exports from `src/lib/auth.ts`. The active handler lives in `src/app/api/auth/[...nextauth]/route.ts`. Ticket 36 Done.

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
