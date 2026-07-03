# Contributing to Family Picnic Platform

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in required secrets
3. Run `bash scripts/dev.sh` for one-command setup (requires Docker)
4. Run `npm run dev` to start the development server

See [AGENTS.md](AGENTS.md) for detailed developer conventions.

## Commit Messages

This project uses conventional commits with commitlint. Format:

```
type(scope): subject
```

Examples:

- `fix(rsvp): release potluck slots on decline`
- `feat(admin): add CSV bulk import`
- `docs(readme): update environment variables`

Rules:

- Header max length: 100 characters
- Subject: imperative mood, lowercase, no trailing period
- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`

Validate before committing:

```bash
printf '%s' "fix(rsvp): release potluck slots on decline" | npx commitlint
```

## Pull Requests

1. Create a feature branch from `main`
2. Run `npm run ci` locally before pushing
3. Open a PR with a clear description
4. Ensure all checks pass (typecheck, lint, test, build)

## Code Style

- Run `npm run format` before committing
- Follow existing patterns in the codebase
- Add TypeScript types for all new functions
- Write tests for new functionality

## Documentation

- Update [AGENTS.md](AGENTS.md) if adding new routes, commands, or conventions
- Update [SPEC.md](SPEC.md) if changing data models or API contracts
- Update [CHANGELOG.md](CHANGELOG.md) under the `[Unreleased]` section
- Add ADRs in `docs/decisions/` for significant architectural decisions

## Testing

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode for development
npm run test:coverage # Coverage report
```

## Database

After modifying `prisma/schema.prisma`:

```bash
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push changes to dev database
```

## Known ESLint Issues

Some files have known lint errors that are safe to ignore:

- `public/sw.js` - Service worker globals not recognized by Node ESLint
- `sw.js` - Browser-only code

See [AGENTS.md](AGENTS.md) for the full list of known issues.
