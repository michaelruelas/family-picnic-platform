# Find Docs Skill

Retrieve current documentation for libraries, frameworks, SDKs, and APIs.

## Usage

Use `ctx7` CLI to fetch up-to-date documentation.

## Process

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"`
2. Pick best match by name match, description relevance, and benchmark score
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using fetched documentation

## Library Name Rules

- Use official names with proper punctuation
- Examples: "Next.js" not "nextjs", "Three.js" not "threejs"

## When to Use

Use for:

- API syntax questions
- Configuration options
- Version migration
- Library-specific debugging
- Setup instructions
- CLI tool usage

Do NOT use for:

- Refactoring
- Writing scripts from scratch
- Debugging business logic
- General programming concepts

## Version-Specific Docs

Use `/org/project/version` from the `library` output.

Example: `/vercel/next.js/v14.3.0`

## Quota Errors

If quota exceeded:

1. Suggest `npx ctx7@latest login`
2. Or set `CONTEXT7_API_KEY` env var

## Skill Triggers

When user asks about a library, framework, SDK, CLI tool, or cloud service — even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot.
