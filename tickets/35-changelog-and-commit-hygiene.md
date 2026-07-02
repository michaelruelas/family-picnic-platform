# Implement CHANGELOG discipline + commit hygiene

## Status

Done — Conventional commits enforced via commitlint + husky, release-please configured for changelog auto-generation.

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
- `commitlint.config.cjs` (create)
- `release-please-config.json` (create)
- `package.json` (add `release:dry` and `release:full` scripts)
