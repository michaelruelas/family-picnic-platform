# Testing Strategy

## Test Types

| Type        | Tool       | Location                      | Purpose                             |
| ----------- | ---------- | ----------------------------- | ----------------------------------- |
| Unit        | Vitest     | `**/*.test.{ts,tsx}`          | Component logic, schemas, utilities |
| Integration | Vitest     | `tests/integration/*.test.ts` | API routes, database operations     |
| E2E         | Playwright | `playwright-tests/*.spec.ts`  | Full user flows                     |

## Running Tests

```bash
npm test             # Run Vitest (unit + integration)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report

npm run test:e2e    # Run Playwright e2e tests
```

## Test File Organization

### Unit Tests

Files matching `**/*.test.{ts,tsx}`:

- `src/lib/__tests__/` - Library tests (auth, prisma, tRPC)
- `src/hooks/__tests__/` - Hook tests
- Component tests co-located with components

### Integration Tests

Located in `tests/integration/`:

- `rsvp-deadline-validation.test.ts` - API validation
- `invitation-reuse.test.ts` - Token single-use logic
- `potluck-collision.test.ts` - Race condition handling
- `csv-import.test.ts` - Bulk import
- `waitlist.test.ts` - Waitlist promotion
- `rsvp-cumulative.test.ts` - Headcount aggregation

### E2E Tests

Located in `playwright-tests/`:

- `auth.spec.ts` - Login/logout flows
- `admin.spec.ts` - Admin event management
- `user.spec.ts` - User RSVP and browsing
- `snapshots.spec.ts` - Page screenshot tests

## E2E Setup

Before running e2e tests for the first time:

```bash
npm run db:push      # Push schema to database
npm run db:seed      # Seed test users
npx playwright install chromium
```

Update snapshots:

```bash
npm run test:e2e -- --update-snapshots
```

## CI Configuration

CI runs:

1. `bun install --frozen-lockfile`
2. `bun run typecheck`
3. `bun run lint`
4. `bun test` (with `playwright-tests/` excluded via `--path-ignore-patterns`)
5. `bun run db:validate`
6. `bun run build`

Note: `bun test` excludes `playwright-tests/` automatically in CI via `--path-ignore-patterns`.

## Test Data

Seeded test accounts (password: `password123`):

- `admin@family-picnic.example.com` - Admin
- `maria.garcia@example.com` - User (Garcia family)
- `lisa.thompson@example.com` - User (Thompson family)
- `priya.patel@example.com` - User (Patel family)

Seeding resets data - run `npm run db:seed` after schema changes.

## Writing Tests

### Schema Tests

Test Zod validation with `safeParse()`:

```typescript
const result = schema.safeParse(inputData);
expect(result.success).toBe(true);
```

### API Route Tests

Read route files directly to verify validation logic:

```typescript
const content = await fs.readFile(routePath, 'utf-8');
expect(content).toContain('validation check');
```

### Integration Tests

Use `fs.readFile` to inspect source files for specific patterns (not runtime tests).

## Known Test Issues

- `src/lib/__tests__/auth.test.ts` expects only 1 provider (Google), but dev auth adds a second (credentials). This test may fail when `DEV_AUTH_ENABLED=true`.
