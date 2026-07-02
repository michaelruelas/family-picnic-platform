# Implement Admin Dashboard page

## Status

Done — `src/app/admin/dashboard/page.tsx` and `src/components/admin/DashboardCard.tsx` implemented.

## Description

SPEC §2.1 lists an `Admin` role with elevated capabilities (invite guests,
override RSVPs, manage potluck categories, broadcast messages, view dashboards,
CSV import, audit log access). MVP requires an Admin Dashboard per SPEC §9.

Build `/admin/dashboard` showing per-event:

- Headcount (confirmed / pending / declined)
- Capacity utilization
- Potluck food summary (slots + signups + dietary breakdown)
- Recent audit log entries
- Quick actions: publish/close event, broadcast message, send reminders

## Acceptance criteria

- Route is gated behind `adminProcedure` (already exists in `src/lib/trpc.ts:46`).
- Page renders aggregated metrics from `RSVP`, `PotluckSignup`, `Invitation`,
  `CommunicationLog`, `AdminAuditLog`.
- Includes links to the other admin sub-pages.

## Files

- `src/app/admin/dashboard/page.tsx` (create)
- `src/server/routers/admin.ts` (create)
- `src/components/admin/DashboardCard.tsx` (create)
