# PR Reviewer Skill

Comprehensive PR review using multiple specialized lenses.

## Review Process

1. Read PR title and body to understand intent
2. Evaluate implementation against stated intent
3. Review diff as source of truth (repo is context only)
4. Check for bugs, security issues, correctness edge cases
5. Report only material issues with evidence

## Issue Classification

### Must-Fix (Report)

Issues that meet ALL of:

- Objective and verifiable from diff + repo evidence
- Introduced by this PR (not pre-existing)
- Material: bugs, security/privacy risks, correctness edge cases, backwards-compat breakage, missing implementations, or clear convention violations

### Nice-to-Have (Report)

- Non-blocking improvements
- Suggestions for code quality
- Optional enhancements

### Do NOT Report

- Pre-existing issues
- Pedantic nitpicks
- Issues a linter would catch
- Subjective style preferences
- "Might" concerns without evidence
- Missing tests (unless explicitly required)

## Evidence Rules

- Reference specific file paths and line numbers from the diff
- Use exact code snippets when quoting
- Do not speculate — if you can't verify, drop it
- Use "approx" only when diff doesn't expose exact lines

## Output Format

```
<1-2 sentence summary of intent and top-level verdict>

Must-fix:
- <issue> - <brief why> - <file:line-range> - Action: <one-line action>

Nice-to-have:
- <issue> - <brief why> - <file:line-range> - Action: <one-line action>
```

## High-Signal Bar

Only report issues that:

1. Will cause incorrect runtime behavior
2. Introduce security/privacy risks
3. Break backwards compatibility
4. Violate explicit project conventions
5. Are missing implementations across modules

## Skill Triggers

- "review this PR"
- "review my changes"
- "code review"
- "give me feedback on this diff"
