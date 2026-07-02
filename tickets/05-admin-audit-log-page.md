# Implement Admin Audit Log page

## Status

Partial — page UI implemented, automatic audit middleware blocked by TypeScript typing issues (see ticket 18).

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
  `AdminAuditLog` entry with action label and JSON diff. **BLOCKED - see ticket 18.**
- Page is server-rendered with at least basic filter UI. **DONE**
- Backfilled seed data for testing. **NOT DONE**

## Files

- `src/app/admin/audit-log/page.tsx` (create) ✅
- `src/components/admin/AuditLogTable.tsx` (create) ✅
- `src/lib/audit.ts` (create — central helper) ✅
- `src/app/api/admin/audit-log/route.ts` (create) ✅
- `src/server/routers/admin.ts` (extend) - audit wiring blocked
