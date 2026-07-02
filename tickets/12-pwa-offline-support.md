# PWA configuration: manifest, service worker, offline cache

## Status

Missing — `public/` directory is empty; no `manifest.webmanifest`,
no `sw.js`, no offline support.

## Description

SPEC §4.6 and §7.3 require a PWA that works offline at the picnic:
service worker caches static assets, IndexedDB caches event/potluck data,
background sync queues uploads. SPEC §3 design principles call out
"Offline resilience" as load-bearing.

Implement:

- `public/manifest.webmanifest` with icons (192, 512) and theme color.
- `public/sw.js` (or workbox-generated) with cache strategies:
  - `cache-first` for static assets, icons, manifest.
  - `stale-while-revalidate` for HTML pages.
  - `network-first` with cache fallback for tRPC/RSC.
- IndexedDB layer for event details + potluck list.
- "Offline" indicator using `navigator.onLine`.
- Service worker registration in client `Providers.tsx`.

## Acceptance criteria

- Lighthouse PWA audit passes.
- Adding to Home Screen works on iOS and Android.
- Visiting `/events/[id]` twice online then going offline still renders
  cached event details + potluck summary.
- RSVP / upload forms are disabled with an offline banner.

## Files

- `public/manifest.webmanifest` (create)
- `public/sw.js` (create)
- `public/icons/icon-192.png`, `public/icons/icon-512.png` (add assets)
- `src/hooks/useOffline.ts` (create)
- `src/components/OfflineBanner.tsx` (create)
- `src/components/Providers.tsx` (register SW)
