# Auto-release potluck slots on RSVP cancellation

## Status

Done — SPEC §4.3: "Potluck slots auto-release when RSVP is DECLINED,
RSVP modified below required count, RSVP deleted after deadline."

## Description

Currently `src/app/api/rsvp/route.ts` lets a user decline their RSVP
without touching their `PotluckSignup` rows. The slot stays booked.

Implement:

- On RSVP transition to `DECLINED`, delete all `PotluckSignup` rows tied
  to that RSVP.
- Decrement `PotluckSlot.currentSignups` correctly in the same
  transaction.
- Notify the household (in case slot was meaningful).
- Audit the release.

## Acceptance criteria

- Declining an RSVP with a potluck signup → signup row deleted, slot
  count decremented, audit log written.
- A test covering the full decline flow.

## Files

- `src/app/api/rsvp/route.ts` (update)
- `src/server/routers/rsvp.ts` (post-migration)
- `tests/integration/rsvp-decline-release.test.ts` (create)
