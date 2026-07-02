# Empty-state and loading polish

## Status

Done — `/events/loading.tsx` and `/my-events/loading.tsx` now provide loading skeletons. Root `error.tsx` already exists with friendly error UI.

## Description

`src/app/loading.tsx` exists but most pages don't show a meaningful
loading state. Error states fall through to a generic `error.tsx` per
SPEC §1 design principle "forgiving interactions."

Implement:

- Per-page loading skeletons (`/events/loading.tsx`, `/my-events/loading.tsx`).
- A friendly error boundary that explains what happened and offers
  "Try again" instead of the Next.js default.
- "Last updated at" timestamps on cached data.
- Pull-to-refresh on mobile.

## Acceptance criteria

- No page flashes blank content on initial load.
- Errors show a plain-language message, not a stack trace.
- Cached pages display a timestamp.

## Files

- `src/app/loading.tsx` (extend)
- `src/app/events/loading.tsx` (create)
- `src/app/my-events/loading.tsx` (create)
- `src/app/error.tsx` (replace with friendly version)
- `src/components/FriendlyError.tsx` (create)
