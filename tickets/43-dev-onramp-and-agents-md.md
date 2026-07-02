# Add `start` index entry, AGENTS.md skeleton

## Status

Done — Created `AGENTS.md` at repo root with build/test/lint commands, route map, tRPC conventions, what-not-to-touch areas, and ticket reference. Created `scripts/dev.sh` for one-command dev setup (Docker Postgres + Next.js). Created `docker-compose.yml` for local PostgreSQL. Updated README.md scripts table with `start` command.

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
