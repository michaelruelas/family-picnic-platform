# Security Model

## Authentication

Users authenticate via Google, Apple, or Facebook OAuth, or dev credentials (for local development).
Providers without configured env vars are hidden on the login page — a missing credential cannot
produce a half-configured button. The same OAuth provider is reused on the profile page to link
additional accounts to the current user.

### OAuth Provider Matrix

| Provider | User-visible fields                                                            | Setup notes                                                                                                                  |
| -------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Google   | `email`, `name`, `sub`                                                         | Standard Google Cloud OAuth client; `sub` is the stable user id                                                              |
| Apple    | `email` (often hidden after first sign-in), `name` (first sign-in only), `sub` | Requires Apple Developer Team ID, Services ID, Key ID, and ES256 `.p8` private key. Apple rotates emails on `Hide My Email`. |
| Facebook | `email`, `name`, `id`                                                          | Requires Facebook App ID + secret. Business verification may be required for production scopes; track FPP-32.                |

### OAuth Flow (all providers)

1. User clicks "Continue with …" on `/login` (or "Link …" on `/profile` for an already-signed-in user).
2. NextAuth redirects to the provider's OAuth authorize endpoint with a CSRF state.
3. User grants permission; provider redirects back to `/api/auth/callback/<provider>`.
4. NextAuth exchanges the code for tokens and invokes the `signIn` callback.
5. The `signIn` callback delegates to `findOrCreateUserByIdentity` in `src/lib/user-identity.ts`, which resolves the OAuth identity to a local `User` row.
6. The `jwt` callback stamps `token.sub` with the local user id; the `session` callback enriches it with `role` and `householdId`.

### Apple Client Secret

Apple does not accept a static client secret — it must be a signed JWT signed with the
Apple-issued ES256 private key (`.p8`). `src/lib/apple-client-secret.ts` builds the JWT with a
1-hour expiry (a standard, safe assertion window); the auth module caches it and refreshes every
45 minutes via `setTimeout`. The first build runs at module load via top-level await, so the cache
is always populated before the first OAuth callback.

```typescript
// Conceptual shape
new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: keyId })
  .setIssuer(teamId)
  .setExpirationTime(issuedAt + 60 * 60)
  .setAudience('https://appleid.apple.com')
  .setSubject(clientId)
  .sign(privateKey);
```

### Apple Private Relay

Apple's "Hide My Email" relays return an Apple-issued alias (`@privaterelay.appleid.com`) on the
first sign-in and **omit email on subsequent sign-ins**. The lookup cascade refuses sign-in when
no `LinkedIdentity` row exists for the Apple `sub` and no email is returned. The login page
surfaces "Invalid credentials" in that case. Users who rely on private relay should keep their
initial sign-in session active (the `LinkedIdentity` row is what links future silent sign-ins).

Relay aliases are not deliverable inbound: the user controls the underlying address and can
revoke it at any time, so any mail the platform sends to them is at risk of being dropped. To
flag these accounts in the admin UI, the `User` row carries an `emailIsRelay` boolean set by
`isRelayEmail()` in `src/lib/email-relay.ts` at creation time and recomputed whenever an admin
edits the email. The admin user list shows a "Relay" badge next to the email, and the user
detail page surfaces an amber banner explaining the contact limitation. Add new relay domains
to `RELAY_EMAIL_DOMAINS` rather than hardcoding them at the call sites.

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

## Linked Identity & Account Linking (FPP-31)

Each user can sign in through more than one OAuth provider. The `LinkedIdentity` table stores
the `(provider, providerAccountId)` pair per linked provider, with `userId` pointing to the
local user.

### Lookup Cascade

`findOrCreateUserByIdentity` (in `src/lib/user-identity.ts`) runs the following steps for every
OAuth callback:

1. **Existing `LinkedIdentity`** for `(provider, providerAccountId)` → return that user. If the
   user is soft-deleted (`deletedAt` set), refuse and audit `auth.signIn.refused` with
   `reason: 'user_tombstoned'`.
2. **Email missing** from the OAuth profile (Apple private relay on subsequent sign-ins) →
   refuse and audit `reason: 'email_missing'`. No row is created; the user must sign in with
   a provider that already has a `LinkedIdentity` row.
3. **Active user by email** → attach a new `LinkedIdentity` to the existing user and audit
   `auth.identity.linked` with `matchedBy: 'email'`. This is the implicit-linking path.
4. **Tombstoned user by email** → refuse and audit `reason: 'email_tombstoned'`.
5. **No row** → create a new `User` (`role: 'ADMIN_ADULT'`) and the `LinkedIdentity` in one
   `$transaction`. Audit `auth.signIn.succeeded` with `userCreated: true`.

Every decision writes a row to `AdminAuditLog` with the provider, identity id, and outcome.

### Explicit Linking From the Profile Page

The profile page exposes three tRPC procedures:

- `user.listLinkedIdentities` — renders the connected accounts card.
- `user.unlinkIdentity` — removes a `LinkedIdentity` row. The UI blocks the action when only
  one identity is linked so the user always retains at least one sign-in method.
- `user.linkIdentity` — manual link, used after the OAuth callback hands off the
  `providerAccountId`. Currently treated as "after re-auth" — the active session is the
  re-auth proof because the platform has no password system (FPP-31 acceptance). When a real
  password column is added to `User`, tighten `linkIdentityToCurrentUser` to require it.

### Session Preservation on Link Flows

When a signed-in user clicks "Link Apple" / "Link Facebook" from the profile page, the OAuth
callback runs through the same `signIn` callback. If the OAuth provider's email matches the
current user, the implicit link fires and the user stays signed in. If the email does not
match, `findOrCreateUserByIdentity` either creates a brand-new `User` or links to a different
existing user. The `jwt` callback guards against session replacement: it only resolves a new
user id when `token.sub` is unset, so an active session is preserved through any link attempt.
The worst case is a stray `LinkedIdentity` row on the wrong user — recoverable via the audit
log and never produces a takeover of the active session.

### Tombstoned Users

A `User` with `deletedAt` set is a tombstone. No OAuth sign-in creates a new user with that
email and no `LinkedIdentity` is followed to a tombstoned user. The audit log captures every
refusal under `auth.signIn.refused`.

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

| Service        | Credentials               | Access Level      |
| -------------- | ------------------------- | ----------------- |
| Google OAuth   | `AUTH_GOOGLE_ID/SECRET`   | User email, name  |
| Apple OAuth    | `AUTH_APPLE_*`            | User email, name  |
| Facebook OAuth | `AUTH_FACEBOOK_ID/SECRET` | User email, name  |
| Twilio         | `TWILIO_*`                | Send SMS only     |
| Twilio Email   | `TWILIO_FROM_EMAIL`       | Sender address    |
| S3             | `S3_*`                    | Read/write photos |
| PhotoPrism     | `PHOTOPRISM_*`            | Photo processing  |

All OAuth client secrets are sourced from the OpenBao-backed Kubernetes secret `nextjs-secrets`;
see `kubernetes/overlays/pugquilt-dev/external-secrets.yaml` and
`scripts/populate-openbao-secrets.sh`. Real values must be provisioned out-of-band and never
committed.
