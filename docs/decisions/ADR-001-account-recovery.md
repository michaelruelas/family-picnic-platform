# ADR-001: Account Recovery

## Status

Accepted

## Context

SPEC §10 Q1 asks: What happens when a user forgets their Google account? Should we support email/password fallback?

Family members across generations may have varying technical abilities. Relying solely on Google OAuth simplifies the auth system but creates a dependency on users remembering their Google credentials.

## Decision

Google OAuth only. Surface a re-authentication link for users who need to sign in again. Do not implement email/password fallback.

### Rationale

1. Simplifies the auth system - fewer credentials to manage and secure
2. Aligns with privacy-first principle - no additional password database
3. Google provides robust account recovery mechanisms
4. Family members likely already have Google accounts

### Implementation Notes

- Display re-auth link prominently on login page
- If session expires, redirect to login with "session expired" message
- Consider implementing "remember this device" functionality via secure cookies

## Consequences

- Users must remember their Google account credentials
- No fallback if user loses access to their Google account (they must recover via Google)
- Reduces code complexity and attack surface

## Related

- SPEC §10 Q1
- NextAuth.js configuration
