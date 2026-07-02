# Tickets Index

Action items identified by reviewing the current state of the family
picnic platform against [SPEC.md](../SPEC.md) and [docs/architecture.md](../docs/architecture.md).

## How to use

Each file is a self-contained ticket: status, description, acceptance
criteria, and a list of files to touch. Work in the order that makes
sense — many tickets depend on earlier ones (e.g. `01-trpc-router-structure`
must land before any router-specific tickets like `02-admin-dashboard-page`).

## Categories

### Backend / API

- `01-trpc-router-structure.md` — build out the tRPC router tree (foundational)
- `05-admin-audit-log-page.md` / `18-audit-log-middleware.md` — admin audit logging
- `10-photo-upload-flow.md` — S3 + PhotoPrism + EXIF stripping
- `11-photo-deletion-policy.md` — photo delete policy + endpoint
- `19-csv-bulk-import.md` — bulk household/invitation import
- `20-multi-admin-per-event.md` — per-event admin model
- `25-rate-limit-broadcasts.md` — broadcast / invitation spam prevention
- `27-zod-schemas-and-validation.md` — zod everywhere, stable error codes
- `28-potluck-slot-race-condition.md` — atomic slot claim
- `29-rsvp-waitlist.md` — waitlist + auto-promote
- `30-account-recovery.md` — Google-account recovery flow
- `31-scheduled-broadcasts.md` — schedule + cron worker
- `41-invitation-single-use.md` — tokenized single-use invitations
- `42-auto-release-potluck-on-decline.md` — release slots on RSVP decline
- `36-duplicate-nextauth-handler.md` — clean up duplicate NextAuth wiring

### UI / Pages

- `02-admin-dashboard-page.md` — admin overview metrics
- `03-admin-invitations-page.md` — invite households / users
- `04-admin-communications-page.md` — broadcast composer + recipient picker
- `06-household-dashboard-page.md` — household dashboard with cumulative headcount
- `07-household-tree-page.md` — nested household visualization
- `08-event-crud-admin.md` — admin event create / edit / publish / close
- `09-potluck-slot-management.md` — admin potluck slot CRUD
- `15-ui-primitives-library.md` — Button / Input / Card / Modal / Toast
- `16-react-hooks-layer.md` — useOffline, useEvent, usePotluck, useHousehold
- `21-first-time-onboarding.md` — first-run wizard
- `22-dietary-label-filtering.md` — dietary chips + filters + summary
- `23-events-calendar-view.md` — calendar view alongside list
- `24-photo-search.md` — caption / event / reaction search
- `26-empty-route-shells.md` — clean up stub directories
- `33-loading-and-error-states.md` — skeletons + friendly error boundary
- `38-accessibility-audit.md` — axe-core, keyboard nav, contrast
- `37-realistic-seed-data.md` — seed photos / potluck / RSVPs

### Infrastructure

- `12-pwa-offline-support.md` — manifest + service worker + IndexedDB
- `13-kubernetes-manifests.md` — Next.js / Postgres / PhotoPrism manifests
- `39-observability.md` — structured logs + tracing + Sentry + metrics
- `40-backup-and-data-export.md` — Postgres / PhotoPrism backups + user export

### Process / Quality

- `14-resolve-open-questions.md` — close out SPEC §10 open questions
- `17-integration-test-coverage.md` — SPEC §8 edge cases as tests
- `32-repo-documentation.md` — AGENTS.md, README status table
- `34-type-safety-hardening.md` — generated Prisma types everywhere, stricter tsconfig
- `35-changelog-and-commit-hygiene.md` — conventional commits + release-please
- `43-dev-onramp-and-agents-md.md` — AGENTS.md skeleton + one-command dev

## Suggested first 10 picks (rough priority)

1. `01-trpc-router-structure` — unlocks everything else
2. `14-resolve-open-questions` — decide policy before more schema work
3. `08-event-crud-admin` + `09-potluck-slot-management` — admin must be able
   to set up events before anything else is useful
4. `06-household-dashboard-page` + `07-household-tree-page` — core user
   surface
5. `28-potluck-slot-race-condition` — correctness bug in shipped code
6. `42-auto-release-potluck-on-decline` — correctness bug
7. `36-duplicate-nextauth-handler` — small dead-code cleanup
8. `41-invitation-single-use` — security-relevant
9. `37-realistic-seed-data` — needed to develop/test the UI
10. `15-ui-primitives-library` — refactor before more components pile up
