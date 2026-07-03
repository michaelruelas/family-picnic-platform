# Security Model

## Authentication

Users authenticate via Google OAuth or dev credentials (for local development).

### Google OAuth Flow

1. User clicks "Sign in with Google"
2. NextAuth redirects to Google OAuth
3. User grants permission
4. Google redirects back with auth code
5. NextAuth exchanges code for session
6. User is logged in with Google email and name

### Dev Credentials (Local Only)

```bash
DEV_AUTH_ENABLED=true
DEV_AUTH_PASSWORD=password123
```

Login with any seeded user's email and `password123`.

## Authorization Model

### User Roles

| Role          | Description                                |
| ------------- | ------------------------------------------ |
| `GUEST`       | Limited to RSVP for own invitation         |
| `MEMBER`      | Full household access, potluck signup      |
| `ADMIN_ADULT` | Admin of own household, can manage events  |
| `ADMIN`       | Full system access, broadcasts, audit logs |

### Role Hierarchy

```
ADMIN > ADMIN_ADULT > MEMBER > GUEST
```

## Middleware Stack

All API routes use a middleware chain:

1. **Auth Check** - Validates session exists
2. **Admin Check** - Verifies role if admin route
3. **Audit Log** - Records mutations (for admin routes)

## Data Isolation

### Household Scoping

All queries for household-specific data are scoped by `householdId` from the session:

```typescript
// Correct - scoped to user's household
const rsvps = await prisma.rSVP.findMany({
  where: { householdId: session.user.householdId },
});

// Incorrect - would return data from all households
const rsvps = await prisma.rSVP.findMany();
```

### Admin Override

Admin routes can bypass household scoping with explicit parameters:

```typescript
adminProcedure.query(async ({ ctx }) => {
  // Admin can query any household's data
  const allRsvps = await prisma.rSVP.findMany();
});
```

## Invitation Tokens

Invitations use single-use tokens for security:

1. Admin creates invitation with unique token
2. Token sent via email link
3. User clicks link, authenticates
4. Token consumed (status → USED)
5. Reusing same link returns error

Tokens expire after `expiresAt` date.

## RSVP Validation

- RSVP deadline must be before event date
- Headcount must be ≥ 1
- Declined RSVPs release potluck slots atomically
- Waitlist promotes in order when spots open

## Audit Logging

All admin mutations are logged to `AdminAuditLog`:

```typescript
auditedAdminProcedure.mutation(async ({ ctx, input }) => {
  // Mutation logged automatically via middleware
  return await prisma.event.update({ ... });
});
```

## External Services Security

| Service      | Credentials             | Access Level      |
| ------------ | ----------------------- | ----------------- |
| Google OAuth | `AUTH_GOOGLE_ID/SECRET` | User email, name  |
| Twilio       | `TWILIO_*`              | Send SMS only     |
| SendGrid     | `SENDGRID_*`            | Send email only   |
| S3           | `S3_*`                  | Read/write photos |
| PhotoPrism   | `PHOTOPRISM_*`          | Photo processing  |
