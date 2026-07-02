# Wire `Audit` middleware into `adminProcedure`

## Status

Done — `auditedAdminProcedure` created in `src/lib/trpc.ts` with properly typed middleware chain. All admin routers migrated to use `auditedAdminProcedure` instead of `adminProcedure`. Every admin mutation now automatically writes an `AdminAuditLog` entry via the `auditLog` middleware.

## Description

`AdminAuditLog` model exists in Prisma and SPEC §2.1 lists "Full audit log
access" as an admin capability. There was previously no code path that
writes to this table.

Implemented:

- Added `AuthedCtx` interface with `session: Session` (non-null) to distinguish from base `Ctx`
- Added type assertions in `isAuthenticated` and `isAdmin` middleware to preserve session narrowing
- Added `auditLog` middleware that captures `{ adminUserId, eventId, action }` after successful mutations
- Created `auditedAdminProcedure` that chains `isAuthenticated`, `isAdmin`, and `auditLog` middleware
- Migrated all admin routers (`admin.router.ts`, `communication.router.ts`, `event.router.ts`, `invitation.router.ts`, `potluck.router.ts`, `rsvp.router.ts`) to use `auditedAdminProcedure`

## Acceptance criteria

- Every `auditedAdminProcedure.mutation` produces exactly one `AdminAuditLog` row. ✅
- `action` is the procedure path (e.g., `event.publish`). ✅
- All existing admin procedures audited. ✅

## Files

- `src/lib/trpc.ts` (add `auditLog` middleware + `AuthedCtx` + `auditedAdminProcedure`)
- `src/server/routers/admin.router.ts` (use `auditedAdminProcedure`)
- `src/server/routers/communication.router.ts` (use `auditedAdminProcedure`)
- `src/server/routers/event.router.ts` (use `auditedAdminProcedure`)
- `src/server/routers/invitation.router.ts` (use `auditedAdminProcedure`)
- `src/server/routers/potluck.router.ts` (use `auditedAdminProcedure`)
- `src/server/routers/rsvp.router.ts` (use `auditedAdminProcedure`)
