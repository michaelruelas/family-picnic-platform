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

## SMS Consent

Outbound SMS is consent-gated end-to-end. Before any Twilio send:

1. **Explicit consent** is captured on the `User` row (`smsConsent` + `smsConsentAt` + `smsConsentIp`).
2. **Communication preference** must be `SMS` or `BOTH`. Users on `EMAIL` or `NONE` are excluded from any SMS broadcast.
3. **Valid E.164 phone** must be on file. Recipients without one are skipped.
4. **Broadcast recipient resolution** applies `communicationPreference: { in: ['SMS', 'BOTH'] }` for SMS channels and `['EMAIL', 'BOTH']` for email channels, in both the tRPC `sendBroadcast` and the REST `/api/admin/communications/send` endpoint.
5. Every send — success, failure, or refusal — writes an `AdminAuditLog` entry with `action: 'sms.send'` (or `admin.sendSms` for the per-event endpoint) and the outcome / Twilio SID / error in `newValue`.

### Endpoints

| Endpoint                                  | Purpose                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `POST /api/admin/communications/send-sms` | Per-event admin SMS, scoped to one event, message ≤ 1600 chars |
| `POST /api/admin/sms/send`                | Ad-hoc admin SMS, no event required, message ≤ 320 chars       |
| tRPC `communication.sendSms`              | Same per-event admin SMS, callable from server components      |

All three paths share the `dispatchAdminSms` helper in `src/lib/sms-dispatch.ts`; only the response shape differs.

The Twilio account SID, auth token, and the E.164 sender number (`TWILIO_PHONE_NUMBER`) are sourced from the OpenBao-backed Kubernetes secret `nextjs-secrets`; see `kubernetes/overlays/pugquilt-dev/external-secrets.yaml` and `scripts/populate-openbao-secrets.sh`. Real values must be provisioned out-of-band and never committed.

### Consent IP capture

`smsConsentIp` records the originating client IP at the moment of consent. Because Next.js does not expose the raw socket, we resolve the IP from proxy headers via `src/lib/client-ip.ts`:

- If `TRUSTED_PROXY_IPS` is unset/empty, no proxy headers are trusted and `smsConsentIp` is stored as `null`. This is the safe default — a hostile client cannot claim any source IP.
- If `TRUSTED_PROXY_IPS` is set to a comma-separated list of IPv4 addresses, the helper walks `x-forwarded-for` from right to left and returns the first IP not in the list (standard rightmost-untrusted parse). Falls back to `x-real-ip` only when the allowlist is non-empty.

Set `TRUSTED_PROXY_IPS` to your edge proxy's egress IPs (e.g. the ALB's internal IPs) in every non-dev environment. CIDR support and IPv6 are tracked as follow-ups.

## External Services Security

| Service      | Credentials             | Access Level      |
| ------------ | ----------------------- | ----------------- |
| Google OAuth | `AUTH_GOOGLE_ID/SECRET` | User email, name  |
| Twilio       | `TWILIO_*`              | Send SMS only     |
| SendGrid     | `SENDGRID_*`            | Send email only   |
| S3           | `S3_*`                  | Read/write photos |
| PhotoPrism   | `PHOTOPRISM_*`          | Photo processing  |
