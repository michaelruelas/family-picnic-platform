# Dietary label filtering & aggregation

## Status

Schema has `Dependent.dietaryLabels`, `RSVP.dietaryNotes`, and
`PotluckSignup.dietaryLabels`, but no UI surfaces or filters on these.

## Description

The picnic needs to accommodate dietary restrictions. SPEC §9 lists
"Dietary label filtering" as post-MVP Medium.

Build:

- Filter chips on `/events/[id]` to show only confirmed RSVPs with a given
  dietary need (e.g., "vegetarian", "gluten-free").
- Admin food summary showing how many attendees need each restriction and
  whether the potluck covers it.
- Print-friendly dietary summary for the day-of organizer.

## Acceptance criteria

- Standard label set enforced: `vegetarian`, `vegan`, `gluten_free`,
  `contains_nuts`, `dairy_free`.
- Aggregations on `/admin/dashboard` show "12 vegetarian / 4 vegan / etc."
- Print view produces a clean PDF.

## Files

- `src/components/dietary/DietaryLabelChip.tsx` (create)
- `src/components/dietary/DietaryFilter.tsx` (create)
- `src/server/routers/event.ts` (`getDietarySummary`)
- `src/app/admin/dashboard/page.tsx` (integrate)
- `src/app/admin/events/[id]/dietary/page.tsx` (create, print-friendly)
