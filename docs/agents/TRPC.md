# tRPC Router Structure

tRPC routers handle all typed API communication between client and server.

## Router Files

Located in `src/server/routers/`:

| Router          | File                      | Procedures                                                                    |
| --------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `auth`          | `auth.router.ts`          | session, signIn, signOut, callback                                            |
| `user`          | `user.router.ts`          | me, update, updatePreferences, completeOnboarding, linkHousehold              |
| `household`     | `household.router.ts`     | create, get, getById, update, addMember, removeMember, getCumulativeHeadcount |
| `dependent`     | `dependent.router.ts`     | create, update, remove, list                                                  |
| `event`         | `event.router.ts`         | create, list, getById, update, listAdmins, addAdmin, removeAdmin              |
| `invitation`    | `invitation.router.ts`    | create, send, resend, track, consume                                          |
| `rsvp`          | `rsvp.router.ts`          | confirm, decline, update, getByEvent, getMyRsvp, getHeadcount                 |
| `potluck`       | `potluck.router.ts`       | listSlots, signup, updateSignup, cancelSignup, getFoodSummary                 |
| `photo`         | `photo.router.ts`         | getUploadUrl, confirmUpload, search, delete, addReaction, removeReaction      |
| `communication` | `communication.router.ts` | sendInvite, sendRsvpReminder, sendBroadcast, unsubscribe, getRateLimitStatus  |
| `admin`         | `admin.router.ts`         | getUsers, getAuditLog, dashboard, csvImport, getDietarySummary                |

## Procedure Types

Four procedure types are used, in order of privilege:

```typescript
procedure; // Public - no auth required
protectedProcedure; // Requires authenticated session
adminProcedure; // Requires ADMIN role
auditedAdminProcedure; // Admin + writes to AdminAuditLog
```

## Middleware Chain

```typescript
protectedProcedure = procedure.use(isAuthenticated);
adminProcedure = procedure.use(isAuthenticated).use(isAdmin);
auditedAdminProcedure = procedure.use(isAuthenticated).use(isAdmin).use(auditLog);
```

### isAuthenticated Middleware

Narrows `ctx.session` from `Session | null` to `Session`.

### isAdmin Middleware

Requires user role to be `ADMIN` or `ADMIN_ADULT`.

### auditLog Middleware

Writes entries to `AdminAuditLog` for all mutations.

## Calling tRPC Procedures

From React components:

```typescript
import { trpc } from '~/lib/trpc-client';

// Query
const { data } = trpc.event.list.useQuery();

// Mutation
const mutate = trpc.rsvp.confirm.useMutation();
await mutate.mutateAsync({ eventId, headcount: 3 });
```

## Adding a New Router

1. Create `src/server/routers/newRouter.router.ts`
2. Define procedures using `publicProcedure` or `protectedProcedure`
3. Export router with `export const newRouter = createTRPCRouter({ ... })`
4. Merge into main router in `src/server/trpc.ts`
