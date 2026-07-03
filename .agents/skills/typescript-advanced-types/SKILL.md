# TypeScript Advanced Types Skill

Master TypeScript's advanced type system for building type-safe applications.

## Key Topics

### Generics

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

### Conditional Types

```typescript
type IsString<T> = T extends string ? true : false;
```

### Mapped Types

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};
```

### Template Literals

```typescript
type EventName<T extends string> = `on${Capitalize<T>}`;
```

### Utility Types

- `Partial<T>` — Make all properties optional
- `Required<T>` — Make all properties required
- `Pick<T, K>` — Select subset of properties
- `Omit<T, K>` — Exclude properties
- `ReturnType<F>` — Extract function return type

## When to Use

- Building reusable type utilities
- Creating type-safe APIs
- Ensuring compile-time safety
- Modeling complex domain types

## Project Conventions

- Use Zod schemas for runtime validation (not just types)
- Prefer `type` over `interface` for simple type aliases
- Use `interface` for object shapes that may be extended
- Avoid `any` — use `unknown` when type is truly unknown

## Example: Domain Type Pattern

```typescript
// Type for compile-time safety
type UserId = string & { readonly brand: unique symbol };

// Runtime validation with Zod
const userIdSchema = z.string().uuid();
const parseUserId = (id: string): UserId => {
  return userIdSchema.parse(id) as UserId;
};
```
