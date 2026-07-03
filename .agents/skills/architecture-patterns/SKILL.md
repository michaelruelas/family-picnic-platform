# Architecture Patterns Skill

Implement proven backend architecture patterns including Clean Architecture, Hexagonal Architecture, and Domain-Driven Design.

## When to Use

- Designing clean architecture for a new microservice
- Refactoring a monolith to use bounded contexts
- Implementing hexagonal or onion architecture patterns
- Debugging dependency cycles between application layers

## Key Patterns

### Layered Architecture

```
Presentation → Business Logic → Data Access
```

### Clean Architecture

```
Controllers → Use Cases → Entities → Repositories
```

### Dependency Rule

- Dependencies only point inward
- Inner layers know nothing about outer layers

## Project Structure

This project uses a simplified layered structure:

```
src/
├── app/              # Presentation (Next.js pages)
├── components/       # UI components
├── lib/             # Core business logic
│   ├── schemas/     # Zod validation (use cases)
│   ├── auth.ts      # Authentication
│   └── prisma.ts    # Data access
└── server/
    └── routers/     # tRPC handlers
```

## Recognizing Problems

### Dependency Cycles

If `A imports B` and `B imports A`, you have a cycle. Fix by:

- Extracting shared types to a third module
- Using dependency injection
- Inverting the dependency

### God Classes/Files

If one file does too much, split by:

- Feature or bounded context
- Responsibility (data, logic, presentation)

### Data Access in Handlers

Keep data access in lib/, not in route handlers.

## tRPC Best Practices

- Use procedures, not raw handlers
- Validate input with Zod schemas
- Use middleware for auth, logging, error handling
- Return typed responses
