# ADR-005: RSVP Waitlist

## Status

Accepted

## Context

SPEC §10 Q7 asks: When max capacity is reached, should we offer a waitlist?

Events may have limited capacity. A waitlist allows interested guests to queue for spots if they open up.

## Decision

Yes, implement a waitlist system with automatic promotion when spots open up.

### Rationale

1. Maximizes attendance by filling all available slots
2. Fair first-come-first-served queue
3. Automatic promotion reduces admin overhead
4. Clear UX - users know they have a waitlist position

### Implementation Notes

- When event reaches max capacity, new RSVPs are marked as WAITLIST status
- When a CONFIRMED RSVP is declined or deleted, first WAITLIST entry auto-promotes
- Promotion triggers notification to user via their preferred channel
- Waitlist position is visible in user's "My Events" view
- Waitlist entries expire after event date

## Consequences

- Requires new RSVPStatus: WAITLISTED
- Need waitlist position tracking and display
- Auto-promotion logic must be reliable and transactional

## Related

- SPEC §10 Q7
- RSVP model
- RSVPStatus enum
