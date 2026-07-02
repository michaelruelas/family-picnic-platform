# Type safety hardening

## Status

Partial — `tsconfig.json` strict mode exists, but several `any` /
loosely-typed patterns persist (e.g., `RSVPForm` props use
`existingRsvp?.status: string` instead of `RSVPStatus`).

## Description

The codebase imports `Relationship` from `~/lib/generated/client` in
route handlers but components elsewhere use raw strings. This drifts from
Prisma's generated enums over time.

Harden:

- Replace all `status: string` props with `status: RSVPStatus` from
  generated client.
- Replace `slotType: string` with `slotType: SlotType`.
- Replace `communicationPreference: string` with
  `CommunicationPreference`.
- Use `Prisma.UserGetPayload` for complex shape, not manual interfaces.
- Add `noUncheckedIndexedAccess: true` to `tsconfig.json`.

## Acceptance criteria

- `tsc --noEmit` passes with the stricter config.
- No `any` outside generated files.
- All component props reference the Prisma generated types where
  applicable.

## Files

- `tsconfig.json` (tighter compiler options)
- `src/components/RSVPForm.tsx` (typed status)
- `src/components/PotluckSignupForm.tsx` (typed slot)
- `src/components/ProfileClient.tsx` (typed preferences)
- `src/components/PhotoReactionButton.tsx` (typed reactions)
