# Backup, retention, GDPR-style data export

## Status

Missing — SPEC §10 Q18 asks about PostgreSQL backup frequency. No
strategy exists.

## Description

This is a private family hub but still handles PII (names, emails,
dietary info, photos). We need:

- Daily Postgres logical backups (pg_dump) retained 30 days.
- PhotoPrism volume snapshot weekly.
- A "Download my data" link in `/profile` that exports a zip of the
  user's RSVPs, dependents, photos they uploaded.
- A "Delete my account" soft-delete flow (sets `User.deletedAt`).

## Acceptance criteria

- Backup script (`scripts/backup.sh`) runs nightly via cron in K8s.
- `GET /api/profile/export` returns a zip with JSON manifests + photo
  references.
- Soft-deleted users are excluded from queries via the existing
  `deletedAt` indexes.

## Files

- `scripts/backup.sh` (create)
- `src/app/api/profile/export/route.ts` (create)
- `src/app/profile/page.tsx` (add Export + Delete buttons)
- `src/server/routers/user.ts` (`export`, `deleteAccount` procedures)
