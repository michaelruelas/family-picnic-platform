# Build Event CRUD + admin event management

## Status

Missing — events are only created via `prisma/seed.ts`. No admin UI or tRPC
procedures for create / update / publish / close / cancel.

## Description

SPEC §4.1 requires admins to create events in DRAFT, define potluck slots,
select households, and publish events. Today no UI exists. The seed script
hardcodes one event.

Implement:

- `/admin/events/new` and `/admin/events/[id]/edit` forms.
- tRPC procedures: `event.create`, `event.update`, `event.list`,
  `event.getById`, `event.publish`, `event.close`, `event.cancel`.
- `EventStatus` transitions enforced (DRAFT → PUBLISHED → CLOSED | CANCELLED).
- Validation: `rsvpDeadline` must be before `date`, `maxCapacity` ≥ 1.

## Acceptance criteria

- Admin can create an event end-to-end from the UI.
- Non-admins cannot reach the admin event pages.
- Publishing an event triggers invitations flow (see ticket #03).
- Closing an event blocks new RSVPs at the API layer.

## Files

- `src/app/admin/events/page.tsx` (create — list)
- `src/app/admin/events/new/page.tsx` (create)
- `src/app/admin/events/[id]/edit/page.tsx` (create)
- `src/server/routers/event.ts` (create)
- `src/components/event/EventForm.tsx` (create)
- `src/components/event/EventStatusBadge.tsx` (create)
