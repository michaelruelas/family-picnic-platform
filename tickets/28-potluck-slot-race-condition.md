# Fix race condition in potluck slot signup

## Status

Bug — `src/app/api/potluck-signup/route.ts:75-90` reads
`currentSignups`, then inserts, then increments `currentSignups`. Two
concurrent requests can both pass the `if (currentSignups >= maxSignups)`
check before either commits.

## Description

SPEC §8.3 explicitly calls out: "Database transaction with row-level
locking" — first successful transaction wins. Current code does a
non-transactional read-then-write.

Fix:

- Wrap signup + counter bump in `prisma.$transaction` with
  `isolationLevel: Serializable` (or `SELECT ... FOR UPDATE` via raw SQL
  on the slot row).
- Use `update({ where: { id, currentSignups: { lt: maxSignups } }, ... })`
  pattern — atomic conditional update.
- Return `CONFLICT` if no row updated.
- Add an integration test that fires N concurrent signups and asserts
  exactly `maxSignups` succeed.

## Acceptance criteria

- A test running 50 concurrent signups against a `LIMITED` slot of size
  3 produces exactly 3 successes and 47 `CONFLICT` errors.
- No manual `currentSignups` increment anywhere.

## Files

- `src/app/api/potluck-signup/route.ts` (rewrite)
- `tests/integration/potluck-collision.test.ts` (create)
- Once migrated to tRPC, `src/server/routers/potluck.ts` (`signup`
  procedure)
