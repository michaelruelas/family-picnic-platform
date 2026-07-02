# Photo gallery search & filter

## Status

Done — Full-text search over Photo.caption + uploader name implemented via
`search` procedure with cursor-based pagination. PhotoSearch component provides
caption search, event filter, date range filter, reaction emoji filter, and
sort options (newest/most reacted). Filters combine with AND logic.

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
