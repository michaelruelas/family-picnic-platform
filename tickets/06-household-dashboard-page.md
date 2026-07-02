# Build Household Dashboard

## Status

Done — `/household/page.tsx` implemented with household dashboard showing members,
cumulative headcount, and dependent management. `getCumulativeHeadcount` procedure
added to household router.

## Description

Authenticated users need a single page that shows their household roster,
nested children, aggregate RSVP history across all events, and quick links to
manage dependents.

Build `/household` with:

- Household name + member list (users + dependents).
- Aggregate upcoming RSVPs across the entire household (cumulative headcount,
  per SPEC §8.1).
- Quick add/edit dependent form (reuses logic in `ProfileClient`).
- Link to `/household/tree` for nested visualization.

Also implement SPEC §8.1 cumulative headcount: when Nancy RSVPs 4 and Emily
RSVPs 2 from the same household, the UI shows "6 attendees" and the API
returns the sum.

## Acceptance criteria

- Page is auth-gated.
- Renders dependents from `Dependents` table and household members from
  `User` table.
- Cumulative headcount math is correct and unit-tested.
- Duplicate-detection flag exists when two members from same household both
  RSVPs (SPEC §8.1).

## Files

- `src/app/household/page.tsx` (create)
- `src/components/household/HouseholdCard.tsx` (create)
- `src/components/household/MemberList.tsx` (create)
- `src/server/routers/household.ts` (create — `getById`, `getTree`,
  `addMember`, `removeMember`, `getCumulativeHeadcount`)
- Tests for cumulative headcount aggregation.
