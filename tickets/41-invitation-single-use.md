# Edge case: invitation reuse and single-use tokens

## Status

Done — SPEC §8.5 single-use token enforcement implemented.

## Description

Today invitations are rows pointing to user/household but have no
single-use token. Anyone with a deep link could re-use it.

Implement:

- Add `Invitation.token String @unique` (UUID v7).
- Generate on creation, embed in invitation URL.
- On RSVP creation, mark `Invitation.status = USED` (extend enum).
- Single-use enforcement in the API/router.
- Expiry (e.g., 30 days).

## Acceptance criteria

- Clicking an invitation URL twice → second click sees "Already used"
  message.
- Expired tokens reject with a clear error.
- `InvitationStatus` enum gains `USED` and `EXPIRED` values.

## Files

- `prisma/schema.prisma` (add token, extend enum)
- `prisma/__tests__/schema-integrity.test.ts` (extend)
- `src/server/routers/invitation.ts` (`consume` procedure)
- `src/lib/invitation-token.ts` (create)
- `tests/integration/invitation-reuse.test.ts` (create)
