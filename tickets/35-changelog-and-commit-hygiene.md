# Implement CHANGELOG discipline + commit hygiene

## Status

Single 0.1.0 entry — CHANGELOG.md shows one release. As work scales we
need per-PR / per-week entries and conventional-commit discipline.

## Description

Right now the only CHANGELOG entry is the initial scaffold. Without a
discipline the docs drift from reality.

Implement:

- Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`,
  `test:`) enforced via commitlint + husky.
- `release-please` or `standard-version` to auto-generate CHANGELOG.
- Each PR description references the relevant `tickets/*.md` file.
- `CHANGELOG.md` kept in sync with merged PRs.

## Acceptance criteria

- A non-conventional commit is rejected by husky.
- `npm run release:dry` produces a preview CHANGELOG diff.
- Tickets and PRs cross-reference each other.

## Files

- `.husky/commit-msg` (commitlint hook)
- `commitlint.config.js` (create)
- `.releaserc.json` (release-please config) — optional
- `package.json` (add `release:dry` script)
