# Rate-limit admin broadcasts and invitations

## Status

Missing — SPEC §10 Q16 flags spam prevention as an open question.

## Description

An admin can in theory spam every household dozens of messages per day.
SPEC §10 Q16 asks "Rate limiting on admin broadcasts?" — pick a default.

Implement:

- Per-admin rate limit: max 5 broadcasts / hour, max 1 / 30 minutes per
  recipient group.
- Per-recipient rate limit: max 2 messages / day / user across all
  channels.
- Reject (with helpful error) instead of queue when limit exceeded.
- Surface counter to admin in the composer.

## Acceptance criteria

- API enforces limits via middleware.
- Tests confirm limits are enforced.
- Admin can override with explicit confirmation ("I really want to spam").

## Files

- `src/lib/rate-limit.ts` (create — in-memory or Redis-backed)
- `src/server/routers/communication.ts` (apply limit)
- `src/server/routers/invitation.ts` (apply limit)
- `tests/integration/rate-limit.test.ts` (create)
