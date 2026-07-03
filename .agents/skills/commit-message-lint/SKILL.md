# Commit Message Lint Skill

Validates commit messages against the project's conventional commit format.

## Project Rules

| Rule                | Limit                      |
| ------------------- | -------------------------- |
| `header-max-length` | ≤ 100 characters           |
| `subject-case`      | imperative mood, lowercase |
| `subject-full-stop` | no trailing `.`            |

## Format

```
type(scope): subject
```

## Types

- `feat` - New features
- `fix` - Bug fixes
- `refactor` - Code changes without behavior change
- `perf` - Performance improvements
- `docs` - Documentation only
- `test` - Adding or updating tests
- `build` - Build system or dependencies
- `ci` - CI configuration
- `chore` - Other changes
- `style` - Formatting
- `revert` - Reverting a commit

## Examples

Valid:

- `fix(rsvp): release potluck slots on decline`
- `feat(auth): add dev credentials provider`
- `chore: remove playwright install from prepare script`

Invalid:

- `Fixed the bug` (past tense, no scope)
- `feat: Add new feature` (sentence case)
- `fix(rsvp): release slots.` (trailing period)

## Validation

```bash
printf '%s' "fix(rsvp): release potluck slots on decline" | npx commitlint
```

## Workflow

1. Before committing, run the validation
2. If rejected, fix the subject line
3. Use `git commit --amend` to update — do NOT use `--no-verify`

## Skill Usage

When user says "commit", "git commit", "commit message", or a commit fails validation, invoke this skill.
