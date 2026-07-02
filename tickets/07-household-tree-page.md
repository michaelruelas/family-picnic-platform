# Build Household Tree visualization

## Status

Done — `/household/tree/page.tsx` and `FamilyTree` component created. Recursive tree fetches HouseholdTree relation, renders with simple ul/li structure, mobile-friendly, handles deep nesting with max-depth expand/collapse.

## Description

SPEC §8.2 requires tree visualization for nested households. Schema already
supports `Household.parentHouseholdId` self-relation. The UI to render this
relationship is absent.

Build `/household/tree` showing:

- Hierarchical tree of households (parent at top, children beneath).
- Each node shows household name, member count, RSVP status for active
  events.
- Tap a node to see details (members, RSVPs).
- Indicate pending invitations per child household.

## Acceptance criteria

- Reads `HouseholdTree` relation recursively.
- Renders without external graph library (simple `<ul>` tree is fine for
  MVP; consider `react-flow` later).
- Mobile-friendly (vertical scroll, pinch zoom optional).
- Handles deep trees without layout blow-up.

## Files

- `src/app/household/tree/page.tsx` (create)
- `src/components/household/FamilyTree.tsx` (create)
- `src/server/routers/household.ts` (`getTree` procedure)
