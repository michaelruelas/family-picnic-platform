# Implement Admin Invitations page

## Status

Done — `/admin/invitations` page implemented with event selector, household search, invitation table, and send/resend/track actions. CommunicationLog entries emitted on send/resend. Unsubscribe logs UNSUBSCRIBED status. Added `sentAt` field to Invitation model.

## Description

SPEC §4.1 details the invitation flow: admins create events, define potluck
slots, select/create households, and send invitations. The `Invitation` model
exists in Prisma but no UI or tRPC procedure consumes it.

Build `/admin/invitations` to:

- Pick an event from a dropdown.
- See pending/sent/delivered invitations for that event.
- Search existing households or create new ones.
- Send / resend / track invitations.
- Honor per-recipient `CommunicationPreference` (email vs SMS).

## Acceptance criteria

- New tRPC procedures: `invitation.send`, `invitation.resend`,
  `invitation.trackDelivery`.
- Each invitation emits a `CommunicationLog` row.
- One-click unsubscribe per channel writes a log entry with `UNSUBSCRIBED`
  status.

## Files

- `src/app/admin/invitations/page.tsx` (create)
- `src/server/routers/invitation.ts` (create)
- `src/components/invitation/InvitationTable.tsx` (create)
- `src/lib/communication.ts` (new — Twilio + SendGrid client)
