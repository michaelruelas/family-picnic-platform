# ADR-010: Communication Opt-In Defaults

## Status

Accepted

## Context

SPEC §10 Q15 asks: Should new users opt-in or opt-out by default for communications?

GDPR/CCPA compliance requires explicit consent for certain communications. SMS is particularly sensitive.

## Decision

New users opt-in to EMAIL only by default. SMS requires explicit opt-in consent.

### Rationale

1. Email is less intrusive and lower cost than SMS
2. SMS requires explicit consent due to carrier regulations
3. Opt-in EMAIL default complies with most email regulations
4. Users can always upgrade their preferences

### Implementation Notes

- Default `communicationPreference` = EMAIL for new users
- SMS preference requires checkbox/toggle during onboarding
- Log consent timestamp for both channels
- One-click unsubscribe available for both channels
- Admin broadcasts respect user preferences

## Consequences

- Need consent tracking in User model
- Initial broadcasts only reach users with email preference
- Need explicit SMS opt-in UI
- May need to backfill existing users

## Related

- SPEC §10 Q15
- CommunicationPreference enum
- CommunicationLog model
