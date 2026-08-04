import { RsvpAttending } from '~/lib/generated/enums';

/**
 * One row of the per-attendee fee input. Mirrors the resolved
 * attendance shape from `~/server/rsvp-attendance` so the router
 * can hand the rows it already has to the calculator without a
 * second mapping step.
 */
export interface FeeAttendee {
  attending: RsvpAttending;
  memberAge: number | null;
}

/**
 * Per-event fee configuration. `null` and `{ amountCents: 0 }` both
 * mean "no charge" — the router should never persist a Registration
 * row in that case.
 */
export interface FeeConfig {
  amountCents: number;
  minAge: number;
}

export interface FeeBreakdown {
  amountCents: number;
  qualifyingAttendees: number;
  totalAttendees: number;
}

/**
 * Returns the registration fee total for an attendee roster under
 * the given per-event fee config. An attendee qualifies when:
 *
 * - `attending === RsvpAttending.YES`
 * - `memberAge !== null`
 * - `memberAge >= config.minAge`
 *
 * Returns 0 (no charge) when `config` is null or `config.amountCents`
 * is 0, regardless of the roster.
 *
 * @param attendees the resolved per-member attendance rows
 * @param config per-event fee configuration (amount + min age) or null
 * @returns the total fee in cents, plus a breakdown for display
 */
export function calculateFee(attendees: FeeAttendee[], config: FeeConfig | null): FeeBreakdown {
  if (!config || config.amountCents <= 0) {
    return { amountCents: 0, qualifyingAttendees: 0, totalAttendees: attendees.length };
  }

  let qualifyingAttendees = 0;
  for (const attendee of attendees) {
    if (attendee.attending !== RsvpAttending.YES) continue;
    if (attendee.memberAge === null) continue;
    if (attendee.memberAge < config.minAge) continue;
    qualifyingAttendees += 1;
  }

  return {
    amountCents: qualifyingAttendees * config.amountCents,
    qualifyingAttendees,
    totalAttendees: attendees.length,
  };
}

/**
 * Convenience helper for callers that already have an Event row and
 * the resolved attendance list. Returns 0 when the Event has no
 * per-attendee fee configured.
 */
export function calculateFeeFromEvent(
  attendees: FeeAttendee[],
  event: { registrationFeeCents: number | null; registrationFeeMinAge: number } | null,
): FeeBreakdown {
  if (!event || event.registrationFeeCents === null || event.registrationFeeCents <= 0) {
    return { amountCents: 0, qualifyingAttendees: 0, totalAttendees: attendees.length };
  }
  return calculateFee(attendees, {
    amountCents: event.registrationFeeCents,
    minAge: event.registrationFeeMinAge,
  });
}
