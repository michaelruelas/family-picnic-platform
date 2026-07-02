# Implement account recovery & dependent email-link login

## Status

Missing — SPEC §10 Q1 and Q2 are unresolved.

## Description

Google-only login locks out anyone who loses access to their Google
account. Dependents cannot sign in at all per current SPEC but might
need limited access (e.g., for teen-aged kids to RSVP themselves).

Pick a default and implement:

- **Q1 Recovery:** Add a "find my household" flow that emails the
  household admins who can re-invite. No password fallback.
- **Q2 Dependents:** Add magic-link login for dependents (parent's email
  forwards the link). Optional, can defer.

## Acceptance criteria

- User can request account recovery from `/login`.
- Recovery email lists all household admins and offers re-invite link.
- If dependent login is in scope, magic-link flow is implemented and
  tested.

## Files

- `src/app/recover/page.tsx` (create)
- `src/lib/recovery.ts` (create)
- `src/server/routers/auth.ts` (`requestRecovery` procedure)
- `prisma/schema.prisma` (`RecoveryRequest` model if needed)
