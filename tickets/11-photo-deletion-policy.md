# Photo deletion endpoint

## Status

Done — Soft delete implemented with adminAuditLog entries. Uploader or admin can delete photos.

## Description

No UI or endpoint exists to delete photos. SPEC §10 lists this as an open
question but a sensible default is needed for MVP.

Decide policy:

- **Uploader can delete own photos** — simple, may conflict with shared
  memories.
- **Uploader + admin can delete** — safer.
- **Soft delete only** (`Photo.deletedAt`) — reversible, audit-friendly.

Implement whichever policy is decided and a confirmation modal in the
gallery.

## Acceptance criteria

- API endpoint (or tRPC procedure) that respects the policy.
- Soft-delete preferred to support audit log.
- Audit log entry on every delete.
- Hard delete via a janitorial cron after N days.

## Files

- `src/server/routers/photo.ts` (`delete` procedure)
- `src/components/photos/PhotoCard.tsx` (add delete menu)
- `src/app/admin/audit-log/page.tsx` (filter by action = `photo.delete`)
