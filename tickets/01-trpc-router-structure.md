# Build out tRPC router structure

## Status

Missing — SPEC §5 requires 10 routers, only an empty `appRouter` exists.

## Description

The SPEC defines a full tRPC v11 router tree (`auth`, `household`, `user`,
`event`, `invitation`, `rsvp`, `potluck`, `photo`, `communication`, `admin`).
Currently `src/server/routers/_app.ts` exports an empty router and all business
logic lives in ad-hoc Next.js Route Handlers under `src/app/api/*`.

Decide on a path forward:

- **Option A (recommended):** Build the full tRPC router tree as specified and
  migrate the existing REST endpoints to tRPC procedures.
- **Option B:** Keep REST handlers but add them under the named routers as
  `appRouter.health` etc. — picks up the structure without rewriting calls.

Afterwards, expose a typed tRPC client to React components and remove the
fetch-based calls from `RSVPForm`, `PotluckSignupForm`, `PhotoReactionButton`,
`ProfileClient`.

## Acceptance criteria

- All 10 routers from SPEC §5 exist under `src/server/routers/`.
- `appRouter` is wired up in `_app.ts`.
- Client can call procedures via `trpc.useQuery` / `trpc.useMutation`.
- Existing REST endpoints are either deleted or wrapped in tRPC.

## Files

- `src/server/routers/_app.ts`
- `src/lib/trpc.ts`
- `src/server/trpc.ts`
- `src/app/api/*`
