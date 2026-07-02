# Rate-limit admin broadcasts and invitations

## Status

Done — Rate limiting implemented with per-admin (5/hour), per-recipient-group (1/30min), and per-recipient (2/day) limits. Communication router and invitation router enforce limits. getRateLimitStatus exposes counters to admin UI.

## Description

An admin can in theory spam every household dozens of messages per day.
SPEC §10 Q16 asks "Rate limiting on admin broadcasts?" — pick a default.

Implemented:

- Per-admin rate limit: max 5 broadcasts / hour, max 1 / 30 minutes per
  recipient group.
- Per-recipient rate limit: max 2 messages / day / user across all
  channels.
- Reject (with helpful error) instead of queue when limit exceeded.
- Surface counter to admin via getRateLimitStatus procedure.

## Acceptance criteria

- API enforces limits via middleware. ✅
- Tests confirm limits are enforced. ✅
- Admin can view rate limit status via getRateLimitStatus query. ✅

## Files

- `src/lib/rate-limit.ts` (create)
- `src/server/routers/communication.router.ts` (apply limit)
- `src/server/routers/invitation.router.ts` (apply limit)
- `tests/integration/rate-limit.test.ts` (create)
