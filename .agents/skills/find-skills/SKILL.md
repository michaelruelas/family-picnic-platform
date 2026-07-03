# Find Skills Skill

Helps users discover and install agent skills when they ask about extending capabilities.

## When to Use

Triggers on:

- "how do I do X"
- "find a skill for X"
- "is there a skill that can..."
- "install a skill"

## Skill Discovery Process

1. Understand what the user wants to accomplish
2. Search existing skills that match
3. If no match, suggest creating a custom skill
4. Provide installation instructions

## Available Skills (Project)

Project-specific skills in `.agents/skills/`:

- `commit-message-lint` — Validates conventional commit messages
- `pr-reviewer` — Comprehensive PR review
- `find-docs` — Fetch current library documentation
- `docs-organization` — Set up docs/ directory structure
- `handoff` — Compact conversation for agent transfer
- `code-review-excellence` — Constructive code review feedback

## Creating Custom Skills

A skill consists of:

```
.agents/skills/<skill-name>/
├── SKILL.md          # Main skill file
└── (optional files)   # Supporting files
```

### SKILL.md Format

```markdown
# Skill Name

## When to Use

<triggers that activate this skill>

## Process

<steps to perform the skill>

## Output Format

<what to produce>

## Examples

<example usage>
```

## Skill Naming

Use lowercase with hyphens:

- `commit-message-lint`
- `pr-reviewer`
- `find-skills`

## Skill Triggers in System Prompt

Skills are loaded when a task matches their description. Use the `skill` tool to load:

```typescript
skill({ name: 'skill-name' });
```
