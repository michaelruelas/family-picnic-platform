# Multiple admins per event

## Status

Done — `EventAdmin` model added with `eventId`, `userId`, and `role`
(OWNER/COADMIN/INVITER). Added `listAdmins`, `addAdmin`, `removeAdmin`
procedures to event router. Created `/admin/events/[id]/edit/admins` page
with user search by email and admin management UI. API routes created at
`/api/admin/events/[id]/admins` and `/api/admin/users/search`. Schema
integrity tests extended.

## Description

Currently the only admin concept is `User.role = ADMIN` (a global flag).
SPEC implies per-event admins. MVP scope §9 says "Single admin per event"
required, but the SPEC table at §2.1 calls out multi-admin.

Pick a model:

- **Option A:** Add `EventAdmin` join table (`eventId`, `userId`,
  `permissions`). User.role stays as global ADMIN but per-event role can
  be `OWNER | COADMIN | INVITER`.
- **Option B:** Keep `User.role` but require `User.role = ADMIN` to manage
  any event; simpler but less granular.

Recommend Option A. Migrate accordingly.

## Acceptance criteria

- A household user can be granted admin rights on a single event without
  becoming a global admin.
- Admin dashboard shows the list of admins per event.
- Removing an admin revokes access immediately.

## Files

- `prisma/schema.prisma` (`EventAdmin` model + migration)
- `prisma/__tests__/schema-integrity.test.ts` (extend)
- `src/server/routers/event.ts` (`addAdmin`, `removeAdmin`)
- `src/app/admin/events/[id]/edit/admins/page.tsx` (create)
