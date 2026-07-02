# ADR-004: RSVP Headcount Minimum

## Status

Accepted

## Context

SPEC §10 Q6 asks: Is there a minimum headcount (e.g., 1 for self)?

When confirming attendance, users should clearly indicate how many people from their household are attending.

## Decision

Minimum headcount is 1 (the user themselves). Users cannot RSVP for 0 attendees.

### Rationale

1. An RSVP implies attendance - 0 headcount is effectively a decline
2. Simplifies validation logic
3. Clear distinction between "attending" (headcount >= 1) and "not attending" (decline)

### Implementation Notes

- Validate `headcount >= 1` in RSVP creation/update procedures
- Use decline flow instead of headcount = 0 for non-attendance
- Display headcount as "1+ members" in UI when household has dependents

## Consequences

- Users who don't want to attend should use the decline flow, not headcount 0
- Need clear UI explaining headcount includes user + all dependents

## Related

- SPEC §10 Q6
- RSVP model
- RSVP state machine
