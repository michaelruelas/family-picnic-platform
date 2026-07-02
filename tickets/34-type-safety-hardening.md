# Type safety hardening

## Status

Done — All component props now use Prisma generated types: RSVPStatus in
RSVPForm, SlotType in PotluckSignupForm, Relationship and CommunicationPreference
in ProfileClient. `tsc --noEmit` passes with strict config. PhotoReactionButton
uses emoji string reactions per schema comment "reactions are stored as emoji
strings" — no ReactionType enum exists so string type is correct.

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
