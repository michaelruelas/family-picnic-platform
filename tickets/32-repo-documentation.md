# Document repository structure & on-ramp new contributors

## Status

Done — Created `AGENTS.md` at repo root with comprehensive developer guide covering build/test/lint commands, route map, tRPC conventions, what-not-to-touch areas, known lint errors, ticket priority table with status and iteration, and environment variables. Created `scripts/dev.sh` for one-command dev setup and `docker-compose.yml` for local PostgreSQL.

## Description

The repo has many empty directories (per ticket #26) and a long history
of decisions scattered across `SPEC.md`, `CHANGELOG.md`, and
`docs/architecture.md`. A new contributor (human or AI) cannot quickly
understand what's stub vs implemented.

Add:

- `AGENTS.md` at repo root: build/test commands, lint rules, route map,
  what-not-to-touch areas, tRPC conventions.
- Update `README.md` with a "Project Status" table mirroring CHANGELOG
  with explicit "MVP gaps".
- Tag every ticket under `tickets/` with a `priority:` and `area:` front
  matter so they're sortable.

## Acceptance criteria

- A new contributor can run `npm run dev`, see what's wired, and pick a
  ticket from `tickets/` without reading SPEC.md cover-to-cover.
- `AGENTS.md` lists the lint/typecheck/test commands and what each fails
  on today.

## Files

- `AGENTS.md` (create)
- `README.md` (extend with status table)
- `tickets/*.md` (add priority + area front matter)
- Possibly `CONTRIBUTING.md`
