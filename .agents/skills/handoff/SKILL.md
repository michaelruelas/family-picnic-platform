# Handoff Skill

Compact the current conversation into a handoff document for another agent.

## When to Use

When asked to "handoff", "transfer", or when leaving a conversation that another agent will continue.

## Handoff Document Format

```markdown
# Conversation Handoff

## Current State

<What's done, what's in progress, what's blocked>

## Pending Items

<List of open questions or tasks>

## Context

<Key decisions made, rationale>

## Next Steps

<Recommended actions for receiving agent>

## File Changes

<List of files modified, with brief description>

## Key Artifacts

<Paths to important files created or modified>
```

## Process

1. Summarize current state concisely
2. List pending items with status
3. Document key decisions and rationale
4. Provide recommended next steps
5. Include relevant file paths
6. Flag any blockers or dependencies

## Principles

- Be concise — handoff should fit in one message
- Include enough context for the next agent to continue without re-reading history
- Flag uncertain items explicitly
- Include file paths, not just descriptions
