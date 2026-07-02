# Integration tests for RSVP, potluck, photo flows

## Status

Done — All six SPEC §8 edge cases have passing integration tests. 136 tests total.

## Description

SPEC §8 lists six edge cases that need testing:

1. Cumulative household headcount (Nancy RSVPs 4 + Emily RSVPs 2 = 6).
2. Nested households.
3. Potluck slot collision (concurrent LIMITED slot claim).
4. Offline RSVP attempt.
5. Invitation link reuse.
6. Photo upload failures / chunked retries.

Today none of these are exercised. Set up a test database fixture (Vitest

- ephemeral Postgres via Docker or pg-mem), seed households, run scenarios,
  assert on database state.

## Acceptance criteria

- Each of the six SPEC §8 edge cases has at least one passing integration
  test.
- Tests run in CI without external services (use Testcontainers or
  pg-mem).
- Coverage ≥ 70 % on `src/server/routers/*` once those routers land.

## Files

- `tests/integration/rsvp-cumulative.test.ts` (create)
- `tests/integration/potluck-collision.test.ts` (create)
- `tests/integration/invitation-reuse.test.ts` (create)
- `tests/integration/photo-upload-retry.test.ts` (create)
- `vitest.config.ts` (add integration project)
