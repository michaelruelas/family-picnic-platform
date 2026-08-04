import { formatAmount } from '~/lib/currency';

interface FeeTotalBlockProps {
  /** Snapshot of the registration fee at charge time. Read from
   * `Registration.amountCents`. When 0 (free event), the block
   * renders nothing. */
  amountCents: number;
  /** Currency code from `Event.currency`. */
  currency: string;
  /** Per-attendee fee in cents, from `Event.registrationFeeCents`.
   * Optional — when omitted, the tooltip text just says
   * "per attending member" without the exact amount. */
  perAttendeeCents?: number;
  /** Count of members counted toward the fee (YES + known age + at
   * or above `minAge`). Optional — when omitted, the tooltip text
   * just says "per attending member" without a multiplier. */
  qualifyingAttendees?: number;
  /** Minimum age for the fee to apply, from
   * `Event.registrationFeeMinAge`. Optional. */
  minAge?: number;
}

/**
 * Builds the human-readable per-attendee fee rule for the tooltip.
 * Lives as a small helper so the test file can lock the wording
 * against accidental rewording.
 */
export function buildPerAttendeeTooltip({
  perAttendeeCents,
  currency,
  qualifyingAttendees,
  minAge,
}: {
  perAttendeeCents?: number;
  currency: string;
  qualifyingAttendees?: number;
  minAge?: number;
}): string {
  const hasMultiplier = typeof qualifyingAttendees === 'number';
  const perAttendeeText =
    typeof perAttendeeCents === 'number'
      ? formatAmount(perAttendeeCents, currency)
      : 'the per-attendee fee';
  const plural = hasMultiplier && qualifyingAttendees !== 1;
  const countText = hasMultiplier
    ? `${qualifyingAttendees} ${plural ? 'attendees' : 'attendee'}`
    : '';
  const ageClause = typeof minAge === 'number' && minAge > 0 ? ` age ${minAge}+` : '';
  return [
    `Each registration is charged ${perAttendeeText} per attending member${ageClause}.`,
    countText
      ? `Yours has ${countText} qualifying.`
      : 'Attendance changes update the total on the event page.',
  ].join(' ');
}

/**
 * Confirmation-screen fee total block. Renders the snapshot total
 * from `Registration.amountCents` in `Event.currency` and a tooltip
 * that explains the per-attendee fee rule. Returns null when
 * `amountCents` is 0 so free events show nothing.
 *
 * Server-safe: no `'use client'`. The tooltip uses the native
 * `title` attribute so it works without JS.
 */
export function FeeTotalBlock({
  amountCents,
  currency,
  perAttendeeCents,
  qualifyingAttendees,
  minAge,
}: FeeTotalBlockProps) {
  if (amountCents <= 0) {
    return null;
  }
  const formatted = formatAmount(amountCents, currency);
  const tooltip = buildPerAttendeeTooltip({
    perAttendeeCents,
    currency,
    qualifyingAttendees,
    minAge,
  });
  return (
    <div
      className="bg-sunlight/20 ring-sunlight/40 rounded-2xl px-4 py-3 text-sm ring-1"
      title={tooltip}
    >
      <p className="text-foreground flex items-center gap-2 font-semibold">
        <span>Registration fee total</span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-help text-xs font-normal"
          aria-label={tooltip}
          title={tooltip}
        >
          ⓘ
        </button>
      </p>
      <p className="text-foreground mt-1 text-2xl font-semibold">{formatted}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Snapshot at RSVP time. Changes to the event fee do not retroactively update this amount.
      </p>
    </div>
  );
}
