# Calendar view for events

## Status

Missing — only list views exist (`/events`, `/my-events`).

## Description

A list view is fine for one event, but the family needs to see all annual
gatherings on a calendar (past + future). Add a month / year calendar view
alongside the list.

Implement:

- `/events/calendar` showing a month grid with event chips.
- Click an event chip → opens detail modal or routes to `/events/[id]`.
- Year view with all events marked.
- Mobile-friendly (swipe between months).

## Acceptance criteria

- Calendar shows all `PUBLISHED` events (past and future).
- Today is highlighted; events color-coded by status.
- No external calendar library required (can use plain CSS grid).

## Files

- `src/app/events/calendar/page.tsx` (create)
- `src/components/event/Calendar.tsx` (create)
- `src/components/event/CalendarEventChip.tsx` (create)
