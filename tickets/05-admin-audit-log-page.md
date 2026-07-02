# Implement Admin Audit Log page

## Status

Done — Page UI implemented, automatic audit middleware wired via `auditedAdminProcedure` (see ticket 18). All admin mutations now produce audit log entries.

## Description

`AdminAuditLog` model exists in the Prisma schema. SPEC §2.1 lists "Full audit log
access" as an admin capability and §9 lists it as MVP.

Implemented:

- `/admin/audit-log` page with filterable, paginated table of audit entries
- Filters by `eventId`, `userId`, `action`, date range
- JSON `oldValue` / `newValue` diffs rendered inline
- `auditLog` middleware in `auditedAdminProcedure` automatically writes audit entries for all admin mutations

## Acceptance criteria

- Every mutation through `auditedAdminProcedure` writes a corresponding
  `AdminAuditLog` entry with action label. ✅
- Page is server-rendered with at least basic filter UI. ✅
- `diff()` helper in `src/lib/audit.ts` captures old/new values. ✅

## Files

- `src/app/admin/audit-log/page.tsx` (create) ✅
- `src/components/admin/AuditLogTable.tsx` (create) ✅
- `src/lib/audit.ts` (create — central helper) ✅
- `src/app/api/admin/audit-log/route.ts` (create) ✅
- `src/server/routers/admin.router.ts` (use `auditedAdminProcedure`) ✅
- `src/lib/trpc.ts` (`auditedAdminProcedure` with `auditLog` middleware) ✅
