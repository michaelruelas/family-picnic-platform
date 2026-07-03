# Conventions

Code style, commit messages, and naming conventions for the Family Picnic Platform.

## Commit Messages

This project enforces commitlint with the following rules:

| Rule                | Limit                      |
| ------------------- | -------------------------- |
| `header-max-length` | ≤ 100 characters           |
| `subject-case`      | imperative mood, lowercase |
| `subject-full-stop` | no trailing `.`            |

### Format

```
type(scope): subject
```

Examples:

- `fix(rsvp): release potluck slots on decline`
- `feat(auth): add dev credentials provider`
- `chore(db): update seed data for testing`

### Types

| Type       | Use for                                             |
| ---------- | --------------------------------------------------- |
| `feat`     | New features                                        |
| `fix`      | Bug fixes                                           |
| `refactor` | Code changes that neither fix bugs nor add features |
| `perf`     | Performance improvements                            |
| `docs`     | Documentation only                                  |
| `test`     | Adding or updating tests                            |
| `build`    | Build system or dependency changes                  |
| `ci`       | CI configuration changes                            |
| `chore`    | Other changes not fitting above categories          |
| `style`    | Formatting, missing semicolons, etc.                |
| `revert`   | Reverting a previous commit                         |

### Rules

- Use imperative mood ("add" not "added" or "adds")
- Do not end subject with a period
- Use lowercase for subject
- Reference issues/tickets when applicable

### Validation

Validate before committing:

```bash
printf '%s' "fix(rsvp): release potluck slots on decline" | npx commitlint
```

If the hook rejects, fix the message and use `git commit --amend` — do NOT use `--no-verify`.

## Code Style

- Use TypeScript strict mode
- Prefer `const` over `let`, avoid `var`
- Use named exports over default exports where appropriate
- Zod schemas for validation at API boundaries
- tRPC for all API communication between client and server

## File Organization

### tRPC Routers

Located in `src/server/routers/`:

- One file per router
- Router files named as `*.router.ts`
- Procedures exported from index

### UI Components

Located in `src/components/`:

- `ui/` - Generic primitives (Button, Input, Card, Modal, Toast)
- Domain-specific components in subdirectories
- Server Components preferred, add `'use client'` only when needed

### Schemas

Located in `src/lib/schemas/`:

- One file per domain (`event.ts`, `rsvp.ts`, etc.)
- Zod schemas for both input validation and type inference

## TypeScript

- tsconfig has `noUncheckedIndexedAccess: true`
- Array access requires non-null assertion (`arr[0]!`) or explicit check
- Prisma-generated types in `src/lib/generated/client`

## What NOT to Edit

1. **`src/app/api/auth/[...nextauth]/route.ts`** — NextAuth handler is the single source of truth for auth.
2. **`src/lib/auth.ts`** — Only exports `authOptions` and `getServerSession`.
3. **`prisma/schema.prisma`** — If modified, run `npm run db:generate`. Client generated to `src/lib/generated/client`.
4. **`src/lib/generated/`** — Prisma-generated code. Do not edit manually.
5. **`public/sw.js`** — Service worker has known ESLint `no-undef` errors for browser globals. Safe to ignore.

## ESLint

Known safe-to-ignore errors:

- `public/sw.js` - 23x `no-undef` (browser globals not in Node scope)
- `sw.js` - 1x `no-undef`, 1x `unused-vars`
- `src/app/admin/invitations/InvitationsClient.tsx` - React 19 lint warnings
- `src/components/household/HouseholdClient.tsx` - 2x `unused-vars`
- `src/components/HelpButton.tsx` - 1x `set-state-in-effect`
