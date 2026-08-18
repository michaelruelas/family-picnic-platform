'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRsvpMutation } from '~/hooks';
import { RSVPStatus, RsvpAttending } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import { formatAmount } from '~/lib/currency';
import { RsvpBottomSheet } from './RsvpBottomSheet';
import { RsvpLastUpdated } from './RsvpLastUpdated';

interface MemberAttendance {
  id: string;
  householdMemberId: string | null;
  memberName: string;
  memberAge: number | null;
  attending: RsvpAttending;
}

interface EventRsvpCardProps {
  eventId: string;
  eventName: string;
  eventDate: Date;
  location: string;
  isPast: boolean;
  isLoggedIn: boolean;
  rsvpDeadline: string | null;
  maxCapacity: number | null;
  currentAttending: number;
  /**
   * Per-event fee configuration. The card passes this down to the
   * bottom sheet so it can render the live fee line, and also uses
   * it to decide whether to surface a fee badge on the "You're in!"
   * card.
   */
  registrationFeeConfig?: { amountCents: number; minAge: number; currency: string } | null;
  existingRsvp: {
    id: string;
    status: RSVPStatus;
    headcount: number;
    modifiedAt: string;
    memberAttendances: MemberAttendance[];
    /** Fee snapshotted onto the Registration row at confirm / update time. */
    registrationFeeCents?: number;
    registrationFeeCurrency?: string;
  } | null;
}

export function EventRsvpCard({
  eventId,
  eventName,
  eventDate,
  location,
  isPast,
  isLoggedIn,
  rsvpDeadline,
  maxCapacity,
  currentAttending,
  registrationFeeConfig,
  existingRsvp,
}: EventRsvpCardProps) {
  const { decline } = useRsvpMutation();
  const searchParams = useSearchParams();
  const isRsvpOpen = !isPast && (!rsvpDeadline || new Date(rsvpDeadline) > new Date());
  const isFull =
    maxCapacity !== null && maxCapacity !== undefined && maxCapacity - currentAttending <= 0;
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const shouldAutoOpen = Boolean(
    searchParams?.get('rsvpOpen') === '1' && isLoggedIn && !isPast && isRsvpOpen,
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FPP-115: EventTabs renders this card twice (desktop tab panel +
  // mobile stacked section); the hidden copy is `display:none`.
  // offsetParent is null for hidden elements, so only the visible
  // instance auto-opens the RSVP sheet — prevents duplicate modals
  // when landing on /events/[id]?rsvpOpen=1#dishes.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shouldAutoOpen) {
      if (cardRef.current?.offsetParent != null) {
        setIsSheetOpen(true);
      }
    }
  }, [shouldAutoOpen]);

  const handleDecline = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await decline.mutateAsync({ eventId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPast) {
    return (
      <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1">
        <p className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
          Past event
        </p>
        <h3 className="font-display text-foreground mt-2 text-2xl font-semibold">
          This gathering has passed
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          {existingRsvp?.status === 'CONFIRMED'
            ? 'We hope you had a wonderful time!'
            : 'We hope to see you at the next one.'}
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1">
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
          {formattedDate} · {location.split(',')[0]}
        </p>
        <h3 className="font-display text-foreground mt-2 text-2xl font-semibold">
          Join the gathering
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Sign in to RSVP and let us know you&apos;re coming.
        </p>
        <a
          href={`/login?callbackUrl=/events/${eventId}/rsvp`}
          className="bg-foreground text-background press hover:bg-foreground/90 mt-5 block w-full rounded-sm px-5 py-3 text-center font-semibold transition-all"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (existingRsvp) {
    const isConfirmed = existingRsvp.status === 'CONFIRMED';
    const isDeclined = existingRsvp.status === 'DECLINED';
    const isWaitlisted = existingRsvp.status === 'WAITLISTED';

    return (
      <>
        <div ref={cardRef} className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1">
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            {formattedDate} · {location.split(',')[0]}
          </p>
          {isConfirmed && (
            <>
              <div className="bg-sage/20 text-sage mt-4 inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold">
                <span>✓</span> You&apos;re in!
              </div>
              <h3 className="font-display text-foreground mt-3 text-2xl font-semibold">
                See you at {eventName}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {existingRsvp.headcount} {existingRsvp.headcount === 1 ? 'person' : 'people'} on the
                way
              </p>
              {(existingRsvp.registrationFeeCents ?? 0) > 0 && (
                <div className="bg-sunlight/20 ring-sunlight/40 mt-3 rounded-sm px-4 py-3 text-sm ring-1">
                  <span className="text-foreground font-semibold">
                    Registration fee:{' '}
                    {formatAmount(
                      existingRsvp.registrationFeeCents ?? 0,
                      existingRsvp.registrationFeeCurrency ?? 'usd',
                    )}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    Snapshot at RSVP time — changes to the event fee do not retroactively update
                    this amount.
                  </span>
                </div>
              )}
              <RsvpLastUpdated modifiedAt={existingRsvp.modifiedAt} />
              {isRsvpOpen && existingRsvp.memberAttendances.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {existingRsvp.memberAttendances.map((att) => (
                    <li key={att.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground/85">{att.memberName}</span>
                      <span
                        className={
                          att.attending === RsvpAttending.YES
                            ? 'text-sage font-semibold'
                            : att.attending === RsvpAttending.MAYBE
                              ? 'text-sunlight font-semibold'
                              : 'text-muted-foreground'
                        }
                      >
                        {attendingLabel(att.attending)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {isRsvpOpen && (
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={() => setIsSheetOpen(true)}
                    className="bg-terracotta press hover:bg-terracotta-hover rounded-sm px-4 py-2.5 text-sm font-semibold text-white transition-all"
                    data-testid="rsvp-card-edit-link"
                  >
                    Edit attendance &amp; dishes
                  </button>
                  <Link
                    href={`/my-events/${existingRsvp.id}/confirmation`}
                    className="border-border bg-card text-foreground press hover:border-foreground rounded-sm border px-4 py-2.5 text-center text-sm font-semibold transition-all"
                  >
                    View confirmation
                  </Link>
                  <button
                    onClick={handleDecline}
                    disabled={isSubmitting}
                    className="text-muted-foreground hover:text-destructive rounded-sm px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : "Can't make it"}
                  </button>
                </div>
              )}
            </>
          )}
          {isDeclined && (
            <>
              <div className="bg-secondary text-muted-foreground mt-4 inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold">
                You declined
              </div>
              <h3 className="font-display text-foreground mt-3 text-2xl font-semibold">
                Changed your mind?
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                You can switch back to attending any time before the deadline.
              </p>
              <RsvpLastUpdated modifiedAt={existingRsvp.modifiedAt} />
              {isRsvpOpen && (
                <button
                  onClick={() => setIsSheetOpen(true)}
                  disabled={isFull}
                  className="bg-terracotta shadow-soft press hover:bg-terracotta-hover mt-5 w-full rounded-sm px-5 py-3 font-semibold text-white transition-all disabled:opacity-50"
                >
                  {isFull ? 'Event is full' : 'RSVP again'}
                </button>
              )}
            </>
          )}
          {isWaitlisted && (
            <>
              <div className="bg-sunlight/25 text-sunlight-foreground mt-4 inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold">
                On the waitlist
              </div>
              <h3 className="font-display text-foreground mt-3 text-2xl font-semibold">
                We&apos;ll let you know
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                If a spot opens up, we&apos;ll be in touch.
              </p>
              <RsvpLastUpdated modifiedAt={existingRsvp.modifiedAt} />
            </>
          )}
        </div>
        <RsvpBottomSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          eventId={eventId}
          eventName={eventName}
          maxCapacity={maxCapacity}
          currentAttending={currentAttending}
          registrationFeeConfig={registrationFeeConfig}
        />
      </>
    );
  }

  if (!existingRsvp && !isPast) {
    const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
    return (
      <>
        <div ref={cardRef} className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1">
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            {formattedDate} · {location.split(',')[0]}
          </p>
          <h3 className="font-display text-foreground mt-2 text-2xl font-semibold">
            {isFull ? 'Join the waitlist' : 'Are you coming?'}
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {isFull
              ? 'This event has reached full capacity. Join the waitlist and we will notify you if a spot opens up.'
              : isRsvpOpen
                ? 'Let us know if your household can make it to this gathering.'
                : 'RSVPs are closed for this event.'}
          </p>
          {spotsRemaining !== null && spotsRemaining > 0 && isRsvpOpen && (
            <p className="text-sage mt-2 text-sm font-medium">
              {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} remaining
            </p>
          )}
          {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
          {isRsvpOpen && (
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => setIsSheetOpen(true)}
                className="bg-terracotta shadow-soft press hover:bg-terracotta-hover w-full rounded-sm px-5 py-3 font-semibold text-white transition-all"
                data-testid="rsvp-card-rsvp-button"
              >
                {isFull ? 'Join Waitlist' : 'RSVP Now'}
              </button>
              <button
                onClick={handleDecline}
                disabled={isSubmitting}
                className="text-muted-foreground hover:text-destructive rounded-sm px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                data-testid="rsvp-card-decline-link"
              >
                {isSubmitting ? 'Updating...' : "Can't make it"}
              </button>
            </div>
          )}
        </div>
        <RsvpBottomSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          eventId={eventId}
          eventName={eventName}
          maxCapacity={maxCapacity}
          currentAttending={currentAttending}
          registrationFeeConfig={registrationFeeConfig}
        />
      </>
    );
  }
}
