# Remove dual NextAuth handler setup

## Status

Done — removed duplicate `GET`/`POST` handler exports from `src/lib/auth.ts`.
Active handler remains in `src/app/api/auth/[...nextauth]/route.ts`. Added
`tests/auth/sign-in.test.ts` covering the signIn callback. Auth test file
`src/lib/__tests__/auth.test.ts` updated to test current exports
(authOptions, getServerSession) instead of removed GET/POST handlers.

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
