# Wire `Audit` middleware into `adminProcedure`

## Status

Missing — `adminProcedure` exists in `src/lib/trpc.ts:46` but never writes
audit log entries.

## Description

`AdminAuditLog` model exists in Prisma and SPEC §2.1 lists "Full audit log
access" as an admin capability. There is currently no code path that
writes to this table.

Add a tRPC middleware that:

- Wraps `adminProcedure`.
- After a successful mutation, captures `{ adminUserId, eventId, action,
oldValue, newValue }` and writes a row.
- Captures the input as `oldValue` (or null for create) and the result as
  `newValue`.

The existing `prisma.adminAuditLog.create` call site should be removed
once the middleware exists, otherwise we get duplicate writes.

## Acceptance criteria

- Every `adminProcedure.mutation` produces exactly one `AdminAuditLog` row.
- `action` is the procedure path (e.g., `event.publish`).
- JSON diff captured automatically (consider a small `diff()` helper).
- All existing admin procedures audited.

## Files

- `src/lib/trpc.ts` (add `auditLog` middleware)
- `src/server/routers/admin.ts` (and any future router) — wrap mutations.
- `prisma/__tests__/schema-integrity.test.ts` (extend to assert
  `AdminAuditLog` indexes exist).
