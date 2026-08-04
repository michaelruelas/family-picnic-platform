# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- **Household payment model + admin view (FPP-48, FPP-16, FPP-14)** — New `Event.registrationFeeMinAge Int` column (default 0, inclusive age threshold for the per-attendee fee). Pure fee calculator at `src/lib/fee.ts` (`calculateFee(attendees, {amountCents, minAge})` and `calculateFeeFromEvent`) — attendees are skipped when `memberAge === null`, and `memberAge >= minAge` qualifies (inclusive boundary). `rsvpRouter.confirm` / `update` / `adminOverride` now read the event's `registrationFeeCents` + `registrationFeeMinAge` from the same transaction as the RSVP write and upsert a `Registration` row with the computed `amountCents`. Settled rows (`PAID` / `REFUNDED` / `FORFEITED` / `CANCELLED`) are never overwritten. `EventRsvpCard` renders the snapshotted fee on the "You're in!" card; `RsvpBottomSheet` shows a live fee line that recomputes on every attendance flip. `EventForm` exposes a "Minimum Age for Fee" integer field (validated 0-120) alongside the existing fee field; `eventCreateSchema` and `eventUpdateSchema` accept the new column; REST `/api/admin/events` POST + PATCH validate and persist it. One-shot backfill at `prisma/backfill-registration-fees.ts` and `src/lib/registration-fee-backfill.ts` (`bun run db:backfill-registration-fees [--apply]`): pins `Registration.amountCents = 0` for every non-settled row, writes one `REGISTRATION_FEE_BACKFILL` audit entry per registration (old + new value + `source: 'backfill-registration-fees'`), idempotent, exits non-zero on any per-row failure. (FPP-15 — the admin payments view — shipped on the FPP-47 branch as an inline design; no separate ticket needed.)
- **RSVP duplicate backfill script (FPP-28)** — `prisma/backfill-rsvp-duplicates.ts` and `src/lib/rsvp-backfill.ts` ship a one-time merge utility for any duplicate `RSVP` rows the pre-fix re-registration bug may have left behind. Per `(eventId, userId)` group, picks the most recent row as the winner (tiebreak: `respondedAt`, then `id`), reassigns any `PotluckSignup` rows to the winner, writes one `RSVP_MERGE` entry to `AdminAuditLog` per loser, and deletes the losers. Wraps each group in a `$transaction`. Default mode is dry-run; pass `--apply` (or run `bun run db:backfill-rsvp-duplicates --apply`) to write. Idempotent and exits non-zero on any per-group failure.

- **Stripe credit card processing (FPP-47)** — `Registration`, `Charge`, and `Refund` models with Stripe PaymentIntent ids; per-event `registrationFeeCents` field; `payment.createPaymentIntent` / `payment.getMyRegistration` / `payment.getPublishableKey` procedures; `admin.listCharges` / `admin.refund` (full + partial, idempotent on the Refund row id) / `admin.forfeit` (no money returned) / `admin.resendReceipt` procedures; Stripe webhook route with `constructEventAsync` signature verification, idempotent on `charge.id`, handling `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, and `charge.updated`; hosted Payment Element checkout page with `return_url` flow; admin `/admin/charges` page with filter, refund dialog, forfeit dialog, and resend-receipt action; branded receipt email template sent on `payment_intent.succeeded` and resendable from admin; every charge and refund writes an `AdminAuditLog` entry. Three new Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) wired through `kubernetes/base/nextjs.yaml`, the dev `ExternalSecret`, and `scripts/populate-openbao-secrets.sh`.

- **Stripe webhook bootstrap script (FPP-47)** — `scripts/setup-stripe-webhook.sh` registers the production webhook endpoint via `stripe webhook_endpoints create`, pushes `stripe-webhook-secret` to OpenBao at `secret/family-picnic-${ENV}/nextjs` (idempotent; refuses to create a duplicate URL), and pins `api_version` to `2025-08-27.basil` to match `src/lib/stripe.ts`. `dev` is intentionally rejected — use `stripe listen` instead. `scripts/lib/openbao.sh` extracts the `bao_exec` / `bao_get_json` / `bao_put_kv` / `extract` helpers so `scripts/populate-openbao-secrets.sh` and the new bootstrap script share them. The populate script accepts a positional `dev|prod` arg. `STRIPE_API_KEY` is bootstrap-only (surfaced into `.env.dev` for convenience; never pushed to OpenBao; never read by the Next.js runtime).

### Fixed

- **Google OAuth signIn lookup** (`src/lib/auth.ts`) — filter `deletedAt: null` on the active-user lookup, then refuse sign-in entirely when the email matches a soft-deleted tombstone. The `User.email` unique index covers soft-deleted rows, so re-provisioning would throw on insert; refusing matches the dev-credentials `authorize` behavior and ADR-001 ("account recovery won't do"). The admin must explicitly re-invite a deleted user.

### Tests

- **Fee calculator coverage** — `src/lib/__tests__/fee.test.ts` (17 tests) covers the calculator: zero-fee and missing-config paths, YES-only filter (NO and MAYBE skipped), null-age skip, `minAge` inclusive boundary, multi-attendee multiplication, and `calculateFeeFromEvent` mapping from an `Event` row.
- **Registration fee backfill coverage** — `src/lib/__tests__/registration-fee-backfill.test.ts` (15 tests) covers dry-run no-op, apply zeros non-settled + audits each, settled-row protection (PAID / REFUNDED / FORFEITED / CANCELLED left alone with real amount in audit newValue per B7), idempotency on a re-run, per-row error isolation, top-level scan failure, formatter output, B6 pre-cutoff scoping (post-cutoff RSVPs are never touched), and `--cutoff` override. `tests/integration/registration-fee-backfill-script.test.ts` (11 tests) verifies the script wiring: thin CLI wrapper, `--apply` and `--cutoff=` flag handling, exit non-zero on errors, package script registered, lib exports, audit action name, `$transaction` wrapping, explicit settled-status guard, B6 cutoff scope, and B7 audit-amount correctness.
- **Fee display coverage** — `EventRsvpCard.test.tsx` (6 new tests) covers the "You're in!" fee badge: hidden when the snapshot is 0 or undefined, rendered with the snapshotted amount + currency, USD fallback, and DECLINED-status suppression. `RsvpBottomSheet.test.tsx` (6 new tests) covers the live fee line: hidden when no fee config, hidden when amount is 0, render with minAge threshold applied, recompute on YES/NO flip, $0 when every attendee is below minAge, and EUR currency rendering. `EventForm.test.tsx` (4 new tests) covers the new "Minimum Age for Fee" field: rendering, pre-fill from `initialData`, submit payload carries `registrationFeeCents` + `registrationFeeMinAge`, and default-to-0 behavior when empty.
- **RSVP backfill coverage** — 12 unit tests in `src/lib/__tests__/rsvp-backfill.test.ts` (dry-run no-op, apply merges + reassigns + audits, idempotent second run, tiebreak order, partial-failure isolation, top-level error handling, formatter output) and 9 integration smoke tests in `tests/integration/rsvp-backfill-script.test.ts` (script wires the lib, defaults to dry-run, exits non-zero on errors, package script registered).
- **OAuth soft-deleted user coverage** (`src/lib/__tests__/auth.test.ts`) — assert the Google signIn callback (1) filters the active-user lookup with `deletedAt: null`, (2) performs an unfiltered tombstone lookup, and (3) returns `false` with no create when the email matches a soft-deleted record. Updated the pre-existing string-pattern smoke test in `tests/auth/sign-in.test.ts` to match the new control flow.
- **Stripe lib + receipt + webhook + payment router coverage** — `src/lib/__tests__/stripe.test.ts` (19 tests) covers env detection, payment-intent creation with `idempotencyKey`, refund creation, signature verification with explicit-secret override, amount formatting, and the test-header helper. `src/lib/__tests__/receipt.test.ts` (5 tests) covers HTML escaping, receipt-link inclusion, and success/failure paths. `src/app/api/stripe/webhook/__tests__/route.test.ts` covers 503 on missing secret, 400 on bad signature, every supported event type, out-of-band `charge.refunded` reconciliation, receipt-failure isolation, retry dedup on `payment_intent.succeeded`, partial-refund reconciliation via `charge.updated`, status-guard against resurrecting `FORFEITED`/`REFUNDED` registrations, and the 200-on-handler-error behavior. `src/server/routers/__tests__/payment.test.ts` and `__tests__/admin-payment.test.ts` cover the user-facing payment flow and the admin charge list / refund / forfeit / resend paths. `tests/integration/payments-fpp47-config.test.ts` verifies the K8s deployment + `ExternalSecret` + populate script + `.env.example` + `stripe.ts` + webhook route + `package.json` all carry the three new Stripe keys. `tests/integration/stripe-webhook-bootstrap.test.ts` (12 tests) verifies the script shape: file-exists, args, env refusal, event subscription, API-version pin, idempotency, OpenBao push, ExternalSecret binding, lib exports, and that the populate script sources the shared OpenBao lib.
- **Transaction retry helper coverage** — `src/lib/__tests__/transaction-retry.test.ts` (10 tests) covers the `withSerializableRetry` helper that backs `payment.createPaymentIntent` and `admin.refund`: P2034 retry, max-attempt exhaustion, non-P2034 passthrough, and the `onRetry` callback.

### Fixed

- **Boop review fixes for FPP-48 (PR #28)** — `syncRegistrationFee` extracted to `src/lib/registration-fee.ts` so the tRPC `confirm` / `update` / `adminOverride` procedures, the `rsvp.create` procedure, and the REST `POST /api/rsvp` route all share one path. B1: `payment.createPaymentIntent` now sources the charge amount from the `Registration` snapshot, with a fallback recompute for legacy pre-FPP-48 RSVPs. B2: after persisting attendances, the full snapshot is reloaded before fee calculation so partial lists do not undercount. B3: fee decreases now reflect immediately and active `Charge` rows are canceled when the amount changes, so a stale Stripe session never ships at the old price. B4: `rsvp.create` and the REST endpoint now run the same fee write. B5: `EventStickyBar` forwards `registrationFeeConfig` to the mobile `RsvpBottomSheet`. B6: backfill scopes to `createdAt < 2026-08-06T09:00:00Z` (the FPP-48 migration timestamp) with a `--cutoff` override flag for safety, so post-deployment RSVPs are never touched. B7: settled-row audit `newValue.amountCents` reports the actual amount, not a misleading zero.

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
