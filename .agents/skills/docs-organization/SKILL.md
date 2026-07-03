# Docs Organization Skill

Set up a `docs/` directory with topic-organized markdown and agent guidance files.

## When to Use

Triggers on:

- "organize docs"
- "move docs to docs/"
- "create AGENTS.md"
- "set up agent files"
- "agent docs pattern"
- Large README (> ~150 lines) that should be split

## Directory Structure

```
docs/
├── README.md              # Index of documentation
├── agents/               # AI agent guidance
│   ├── README.md         # Agent docs index
│   ├── CONTEXT.md        # Project domain and concepts
│   ├── COMMANDS.md       # npm scripts, CLI commands
│   ├── CONVENTIONS.md    # Code style, commits, naming
│   ├── TESTING.md        # Testing strategy
│   ├── ROUTING.md        # Route structure
│   ├── TRPC.md           # tRPC router reference
│   └── SECURITY.md        # Auth and permissions
└── decisions/            # Architecture Decision Records
    └── ADR-001-*.md
```

## Agent Guidance Files

### AGENTS.md

Quick reference at repo root:

- Most-used commands
- Commit message format
- Route summary
- What NOT to edit
- Known issues

### docs/agents/*.md

Comprehensive documentation for each topic.

## Key Principles

1. Single source of truth — docs/agents/ has full content
2. AGENTS.md is a quick reference index, not a duplicate
3. Each doc file covers one topic thoroughly
4. Use code examples liberally
5. Include "what NOT to edit" for sensitive files

## Migration Process

1. Read existing README or AGENTS.md
2. Identify distinct topics
3. Create docs/agents/ structure
4. Move content to appropriate files
5. Update AGENTS.md to reference docs/agents/
6. Verify all references work
