# Photo gallery search & filter

## Status

Missing — SPEC §9 lists "Photo gallery search" as Low priority, but the
feature is unstarted.

## Description

`/photos` shows a chronological grid grouped by event but no search
controls. As the photo library grows across years, finding a specific
photo becomes impossible.

Implement:

- Search by caption text.
- Filter by event, uploader, date range.
- Filter by reaction emoji (e.g., "all photos I reacted to with ❤️").
- Sort options (newest, most reacted).

## Acceptance criteria

- Search is full-text over `Photo.caption` + uploader name.
- All filters combine (AND).
- Results paginate beyond 50 photos.

## Files

- `src/server/routers/photo.ts` (`search` procedure)
- `src/components/photos/PhotoSearch.tsx` (create)
- `src/app/photos/page.tsx` (integrate filters)
