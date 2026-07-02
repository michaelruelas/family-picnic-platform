# Add React hooks layer (offline, event, potluck)

## Status

Missing — `src/hooks/` directory does not exist.

## Description

SPEC §6 lists three custom hooks: `useOffline`, `useEvent`, `usePotluck`.
None exist; components re-implement logic with raw `fetch` + `useState`.

Implement:

- `useOffline()` — returns `{ isOnline, lastOnline }`, listens to
  `online`/`offline` events, integrates with service worker.
- `useEvent(eventId)` — wraps tRPC query for event detail, plus RSVP status
  helpers.
- `usePotluck(eventId)` — wraps tRPC query for slots + signups, plus
  optimistic updates for signup/cancel.
- `useHousehold()` — wraps household + dependents queries.

Each hook should expose loading/error states consistent with React Query
semantics (we use `@trpc/react-query`).

## Acceptance criteria

- All hooks exported from `src/hooks/index.ts`.
- All current components that use raw `fetch` (`RSVPForm`,
  `PotluckSignupForm`, `ProfileClient`, `PhotoReactionButton`) are migrated
  to the new hooks.
- Hooks have unit tests with `renderHook`.

## Files

- `src/hooks/useOffline.ts` (create)
- `src/hooks/useEvent.ts` (create)
- `src/hooks/usePotluck.ts` (create)
- `src/hooks/useHousehold.ts` (create)
- `src/hooks/index.ts` (create)
- `src/hooks/__tests__/*` (create)
