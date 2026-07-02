# Wire `Audit` middleware into `adminProcedure`

## Status

Blocked — TypeScript typing issues prevent middleware from being added to adminProcedure chain.

## Blocker

Adding an audit middleware to the adminProcedure chain (which already has isAuthenticated and isAdmin middleware) causes TypeScript to lose the session null-check narrowing. Error:

```
./src/server/routers/communication.router.ts:65:29
Type error: 'ctx.session' is possibly 'null'.
```

This happens because:
1. The middleware chain is `adminProcedure.use(isAuthenticated).use(isAdmin).use(auditLog)`
2. Each middleware passes ctx to next() with `{ session: ctx.session }`
3. TypeScript doesn't properly track that session is narrowed to non-null after the auth middleware
4. Adding a third middleware (auditLog) exacerbates the type inference issue

Evidence:
- Original trpc.ts with 2 middleware chains passes TypeScript
- Adding any middleware that wraps next() to adminProcedure breaks type inference
- The isAdmin middleware already does: `return next({ ctx: { session: ctx.session } });` which should narrow, but TypeScript loses this when another middleware is added

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

- `src/lib/trpc.ts` (add `auditLog` middleware) - **BLOCKED**
- `src/server/routers/admin.ts` (and any future router) — wrap mutations.
- `prisma/__tests__/schema-integrity.test.ts` (extend to assert
  `AdminAuditLog` indexes exist).

## Possible Solutions

1. Fix tRPC middleware typing - create proper context types that preserve narrowing
2. Create a separate `auditedAdminMutation` procedure that manually wraps mutations
3. Use a different pattern for audit logging that doesn't rely on middleware
