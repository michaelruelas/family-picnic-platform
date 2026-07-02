# Replace ad-hoc fetch calls with tRPC + zod schemas

## Status

Done — shared Zod schemas created in `src/lib/schemas/`, all five API routes
updated to use Zod validation with consistent error codes.

## Description

The current handlers (`rsvp/route.ts`, `potluck-signup/route.ts`,
`dependents/route.ts`, `profile/route.ts`, `photo-reaction/route.ts`)
duplicate validation logic, lack input schemas, and return inconsistent
error shapes. As tRPC routers are built (ticket #01), migrate these and
introduce shared zod schemas in `src/lib/schemas/`.

## Acceptance criteria

- Every input validated with a zod schema exported from `src/lib/schemas/`.
- Every handler uses `TRPCError` with stable codes
  (`UNAUTHORIZED`, `BAD_REQUEST`, `NOT_FOUND`, `CONFLICT`).
- All Prisma writes wrapped in a transaction where multiple rows change
  (especially `potluck-signup` which currently increments
  `currentSignups` after the row insert — race-prone).

## Files

- `src/lib/schemas/rsvp.ts` (create)
- `src/lib/schemas/potluck.ts` (create)
- `src/lib/schemas/dependent.ts` (create)
- `src/lib/schemas/profile.ts` (create)
- `src/lib/schemas/photo.ts` (create)
- `src/app/api/**` (migrate to tRPC procedures — see ticket #01)
