# Agent Guidance Index

This directory contains centralized documentation for AI agents working on the Family Picnic Platform.

## Core Documents

| Document                         | Purpose                                             |
| -------------------------------- | --------------------------------------------------- |
| [CONTEXT.md](CONTEXT.md)         | Project domain, overview, and key concepts          |
| [COMMANDS.md](COMMANDS.md)       | All npm scripts, CLI commands, and dev workflows    |
| [CONVENTIONS.md](CONVENTIONS.md) | Code style, commit messages, and naming conventions |
| [TESTING.md](TESTING.md)         | Testing strategy (Vitest, Playwright, integration)  |
| [ROUTING.md](ROUTING.md)         | Route structure and API endpoint reference          |
| [TRPC.md](TRPC.md)               | tRPC router structure and procedure types           |
| [SECURITY.md](SECURITY.md)       | Auth model, permissions, and data isolation         |

## Quick Reference

For a condensed view of frequently used commands and patterns, see the [quick reference](../QUICKREF.md).

## Skills

Agent skills are stored in:

- `.claude/skills/` - opencode-specific skills
- `.agents/skills/` - cross-agent skills

See individual skill directories for specialized workflows.

## For New Contributors

1. Start with [CONTEXT.md](CONTEXT.md) to understand the domain
2. Read [COMMANDS.md](COMMANDS.md) for dev setup
3. Review [CONVENTIONS.md](CONVENTIONS.md) before making changes
4. Check [TESTING.md](TESTING.md) for testing requirements
