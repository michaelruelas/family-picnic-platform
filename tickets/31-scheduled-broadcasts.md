# Scheduling system for broadcasts

## Status

Missing — SPEC §4.5 step 3 calls for "Admin sets send time (within
reasonable hours constraint)". The `CommunicationLog` schema has no
scheduled-at column.

## Description

Today broadcasts send immediately. SPEC §9 lists "Scheduled broadcasts"
as Medium priority. Implement a job runner that:

- Stores scheduled broadcasts in a `ScheduledCommunication` table.
- A cron-style worker (BullMQ, Inngest, or pg-boss) fires them at the
  scheduled time.
- Honors "reasonable hours" — defer to next 8 AM local if scheduled
  outside 8 AM – 9 PM window.
- Cancel/reschedule UI in `/admin/communications`.

## Acceptance criteria

- Admin can pick a future send time.
- Broadcast fires within 60 s of scheduled time.
- Reasonable-hours deferral is logged with reason.
- Cancel works up until send time.

## Files

- `prisma/schema.prisma` (`ScheduledCommunication` model + migration)
- `src/server/routers/communication.ts` (`schedule` procedure)
- `src/lib/scheduler.ts` (create — worker entrypoint)
- `src/app/admin/communications/page.tsx` (schedule UI)
