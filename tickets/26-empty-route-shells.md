# Migrate empty route shells into actual pages

## Status

Done — Route layout decision documented in docs/architecture.md §8. Confirmed empty route groups (auth) and (event) were not adopted; flat routes used throughout. Navbar links verified to point to valid routes. Empty directories confirmed removed.

## Description

The following directories were scaffolded but never implemented and need
to either be deleted or filled in:

- `src/app/(auth)/login/` — duplicate of `src/app/login/` (use only one).
- `src/app/(auth)/callback/` — OAuth callback (NextAuth handles this via
  `/api/auth/[...nextauth]`; can be deleted).
- `src/app/(event)/[eventId]/rsvp/` — RSVP-only sub-route (current
  `/events/[id]` already shows RSVP inline).
- `src/app/(event)/[eventId]/potluck/` — same.
- `src/app/(event)/[eventId]/photos/` — same.
- `src/app/household/tree/` — needs implementation (ticket #07).
- `src/app/admin/dashboard/`, `invitations/`, `communications/`,
  `audit-log/` — needs implementation (tickets #02–#05).

Pick a direction:

- **Decision needed:** Use route groups (`(auth)`, `(event)`) for
  shared layouts, or flat routes under `/events/[id]/*`?
- Clean up empty shells once the layout decision is documented.

## Acceptance criteria

- No 404 on any link in the navbar.
- ARCHITECTURE.md reflects the chosen route layout.
- Empty directories removed.

## Files

- `src/app/(auth)/**` (decide keep/delete)
- `src/app/(event)/[eventId]/**` (decide keep/delete)
- `docs/architecture.md` (document decision)
