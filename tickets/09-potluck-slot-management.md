# Build Potluck Slot management (admin)

## Status

Missing — slot creation only happens via DB seed; no admin UI or tRPC.

## Description

SPEC §4.1 step 2 is "Admin defines potluck slots and categories". Today
`PotluckSlot` rows are never created from the UI, so any event without
manual DB seeding shows the "No Potluck Slots Yet" placeholder.

Implement admin-side slot management:

- Inside `/admin/events/[id]/edit`, a "Potluck Slots" section.
- Add / edit / delete slots with `category`, `name`, `slotType`,
  `maxSignups`.
- Reorder slots within a category (drag-and-drop optional).
- Bulk-add from a template.

## Acceptance criteria

- tRPC procedures: `potluck.createSlot`, `potluck.updateSlot`,
  `potluck.deleteSlot`, `potluck.listSlots`.
- Deleting a slot cascades to its `PotluckSignup` rows (already configured
  via Prisma `onDelete: Cascade`).
- Form validation enforces `maxSignups` only when `slotType = LIMITED`.
- All slot edits are reflected immediately on `/events/[id]`.

## Files

- `src/app/admin/events/[id]/edit/potluck/page.tsx` (create)
- `src/server/routers/potluck.ts` (create)
- `src/components/potluck/SlotForm.tsx` (create)
- `src/components/potluck/SlotGrid.tsx` (create)
