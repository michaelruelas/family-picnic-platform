# Add `start` index entry, AGENTS.md skeleton

## Status

README mentions `npm start` but no production-mode documentation.
AGENTS.md does not exist.

## Description

Add:

- `AGENTS.md` at root with: build/test/lint commands, route map, tRPC
  conventions, what to avoid editing, ticket reference.
- Production-mode notes in `README.md` (env vars, build, deploy).
- A `scripts/dev.sh` that starts Postgres via Docker + Next.js for
  one-command dev setup.

## Acceptance criteria

- A fresh clone with Docker can run `bash scripts/dev.sh` and have a
  working stack.
- AGENTS.md covers every script in `package.json`.

## Files

- `AGENTS.md` (create)
- `scripts/dev.sh` (create)
- `README.md` (extend)
