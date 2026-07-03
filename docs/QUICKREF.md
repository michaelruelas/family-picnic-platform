# Quick Reference

Essential commands and patterns for daily development.

## Most Used Commands

```bash
npm run dev              # Start dev server
npm run build          # Production build
npm test               # Run tests (Vitest)
npm run test:e2e       # Run Playwright e2e
npm run lint           # Lint
npm run typecheck       # TypeScript check
npm run ci             # Full CI suite
npm run db:push        # Push schema changes
npm run db:seed        # Seed test data
bash scripts/dev.sh    # Full setup (Docker + deps + db + server)
```

## Common Patterns

### Zod Validation

```typescript
import { eventCreateSchema } from '~/lib/schemas';

const result = eventCreateSchema.safeParse(input);
if (!result.success) {
  const firstError = result.error.issues[0]!;
  throw new Error(firstError.message);
}
```

### tRPC Query

```typescript
const { data } = trpc.event.list.useQuery();
```

### tRPC Mutation

```typescript
const mutate = trpc.rsvp.confirm.useMutation();
await mutate.mutateAsync({ eventId, headcount: 3 });
```

### Prisma Update with Transaction

```typescript
await prisma.$transaction(
  async (tx) => {
    await tx.potluckSlot.update({ where: { id }, data: { currentSignups: { increment: 1 } } });
    return tx.potluckSignup.create({ data });
  },
  { isolationLevel: 'Serializable' },
);
```

### RSVP Confirmation Flow

```typescript
const rsvp = await prisma.rSVP.create({
  data: {
    eventId,
    userId: session.user.id,
    householdId: session.user.householdId,
    status: isAtCapacity ? 'WAITLISTED' : 'CONFIRMED',
    headcount,
    dietaryNotes,
  },
});
```

## Dev Auth Login

1. Set `DEV_AUTH_ENABLED=true` in `.env`
2. Go to `/login`
3. Enter email + `password123`

Test accounts:

- `admin@family-picnic.example.com` (Admin)
- `maria.garcia@example.com` (User)
- `lisa.thompson@example.com` (User)
- `bob.thompson@example.com` (User)
- `priya.patel@example.com` (User)

## Commit Format

```
type(scope): subject

fix(rsvp): release potluck slots on decline
feat(auth): add dev credentials provider
```

Validate: `printf '%s' "fix(rsvp): release potluck slots" | npx commitlint`

## Route Files

- Pages: `src/app/[route]/page.tsx`
- API: `src/app/api/[route]/route.ts`
- tRPC: `src/server/routers/[router].router.ts`

## What NOT to Edit

- `src/app/api/auth/[...nextauth]/route.ts`
- `src/lib/auth.ts`
- `src/lib/generated/`
- `prisma/schema.prisma` (without regenerating client)
