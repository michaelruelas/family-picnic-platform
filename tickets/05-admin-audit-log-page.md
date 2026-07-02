# Implement Admin Audit Log page

## Status

Missing — directory exists but `page.tsx` is not implemented.

## Description

`AdminAuditLog` model exists in the Prisma schema but no middleware writes to
it and no UI exposes it. SPEC §2.1 lists "Full audit log access" as an admin
capability and §9 lists it as MVP.

Build `/admin/audit-log` with:

- Filterable, paginated table of audit entries.
- Filters by `eventId`, `userId`, `action`, date range.
- JSON `oldValue` / `newValue` diffs rendered inline.
- Export-to-CSV (defer if needed).

Also wire an `audit()` helper into all admin procedures so any
`adminProcedure` call automatically appends a row.

## Acceptance criteria

- Every mutation through `adminProcedure` writes a corresponding
  `AdminAuditLog` entry with action label and JSON diff.
- Page is server-rendered with at least basic filter UI.
- Backfilled seed data for testing.

## Files

- `src/app/admin/audit-log/page.tsx` (create)
- `src/lib/audit.ts` (create — central helper)
- `src/server/routers/admin.ts` (extend)
- Update existing router procedures to call `audit(...)` after mutation.
