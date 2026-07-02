# ADR-006: RSVP Closing

## Status

Accepted

## Context

SPEC §10 Q8 asks: Should we auto-close RSVPs after deadline or allow admin extension?

RSVP deadlines help with event planning. However, circumstances may require flexibility.

## Decision

RSVPs auto-close at the deadline. Admins can extend the deadline by 24 hours one time.

### Rationale

1. Auto-close provides finality for event planning
2. 24-hour extension window handles most extenuating circumstances
3. Prevents endless extensions that undermine the deadline system
4. Admin override respects the human judgment of event organizers

### Implementation Notes

- Cron job checks deadline and sets event status to CLOSED
- Admin UI shows "Extend deadline" button (max 24h)
- Multiple 24h extensions not allowed
- Visual indicator shows when deadline has been extended
- Notify all invited households of extension

## Consequences

- Need event status tracking
- Admin extension is one-time only - must be communicated clearly
- May need UI to show "deadline extended" badge

## Related

- SPEC §10 Q8
- Event model
- EventStatus enum
