# Implement waitlist when event capacity reached

## Status

Missing — SPEC §4.1 edge cases: "Max capacity reached → show waitlist
option." SPEC §10 Q7 also flags this as an open question.

## Description

Currently when `maxCapacity` is reached, `RSVPForm` shows "Event is full"
with no fallback (see `src/app/api/rsvp/route.ts:60-69`). Spec wants a
waitlist that auto-promotes on cancellation.

Implement:

- New `RSVP.status = WAITLISTED` enum value (or new join table).
- Waitlist position surfaced in `RSVPForm`.
- On RSVP decline or cancellation by another household, the highest
  waitlisted user is auto-promoted and notified.

## Acceptance criteria

- When capacity is full, RSVPs succeed but land in waitlist with a
  position number.
- Auto-promotion is transactional and audited.
- Waitlisted users notified via preferred channel.

## Files

- `prisma/schema.prisma` (add `WAITLISTED` enum + `waitlistPosition` int)
- `src/app/api/rsvp/route.ts` (logic update)
- `src/server/routers/rsvp.ts` (post-tRPC migration)
- `src/components/RSVPForm.tsx` (show waitlist UI)
- `tests/integration/waitlist.test.ts` (create)
