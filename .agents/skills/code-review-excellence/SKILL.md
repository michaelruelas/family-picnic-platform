# Code Review Excellence Skill

Master effective code review practices to provide constructive feedback.

## Review Principles

1. **Be constructive** — frame feedback to help, not to show superiority
2. **Be specific** — cite exact lines, not general impressions
3. **Be timely** — review promptly to unblock the author
4. **Distinguish blocking vs non-blocking** — clearly label must-fix vs nice-to-have

## What to Look For

### Correctness

- Logic errors
- Edge cases not handled
- Error handling missing
- Race conditions
- Memory leaks

### Security

- SQL injection
- XSS vulnerabilities
- Auth bypass
- Data exposure
- Secrets in code

### Performance

- N+1 queries
- Unnecessary re-renders
- Missing indexes
- Large payloads

### Maintainability

- Code duplication
- Complex nested conditionals
- Magic numbers
- Poor naming

## Feedback Templates

### For Bugs

> "This will cause [specific bad outcome] because [reason]. See [file:line]. Consider [alternative]."

### For Suggestions

> "Optional: [suggestion] would improve [aspect]. [Brief explanation]."

### For Questions

> "Can you help me understand why [specific choice]? I'm not sure I follow the reasoning."

## Anti-Patterns to Avoid

- "This is wrong" (instead: "This could cause...")
- Nitpicking style (unless project style guide violated)
- Vague feedback ("this could be better")
- Making the author justify decisions that don't need justification
- Comparing to how they would have done it

## Skill Triggers

- "review this code"
- "review my PR"
- "code review"
- "give feedback on this"
