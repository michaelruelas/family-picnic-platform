# Remove dual NextAuth handler setup

## Status

Duplicate — `src/lib/auth.ts:49` exports `handler as GET, handler as
POST` AND `src/app/api/auth/[...nextauth]/route.ts:1` does the same.
Two code paths for the same logic is a footgun.

## Description

`src/lib/auth.ts` exports the NextAuth handler at module scope, but
nothing imports `GET` or `POST` from there. The active handler lives in
`src/app/api/auth/[...nextauth]/route.ts`. The lib version is dead code
that will rot.

Decide:

- **Recommended:** Delete the exports from `src/lib/auth.ts`, keep only
  `authOptions` and `getServerSession`. Move handler instantiation into
  the route file (already done).
- Confirm `signIn` callback in `src/lib/auth.ts:28-45` (auto-creates
  `ADMIN_ADULT` users) runs only once per login. Add a test.

## Acceptance criteria

- `src/lib/auth.ts` no longer exports `GET`/`POST`.
- New user sign-in still creates a `User` row with default role.
- A test covers the `signIn` callback.

## Files

- `src/lib/auth.ts` (trim)
- `tests/auth/sign-in.test.ts` (create)
