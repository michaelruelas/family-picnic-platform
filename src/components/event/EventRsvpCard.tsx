'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  /**
   * FPP-89: when the logged-in caller has a pending invitation
   * for this event, the no-RSVP card swaps the primary "RSVP Now"
   * CTA (which launches the bottom sheet) for a pointer to their
   * invitation. The bottom sheet is no longer the primary RSVP
   * entry point on the event page; the invitation wizard is.
   */
  hasPendingInvitation: boolean;
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
  hasPendingInvitation,
  existingRsvp,
}: EventRsvpCardProps) {
  const { decline } = useRsvpMutation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRsvpOpen = !isPast && (!rsvpDeadline || new Date(rsvpDeadline) > new Date());
  const isFull =
    maxCapacity !== null && maxCapacity !== undefined && maxCapacity - currentAttending <= 0;
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

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
      <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1">
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
      <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1">
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
          href="/login"
          className="rounded-pill bg-foreground text-background press hover:bg-foreground/90 mt-5 block w-full px-5 py-3 text-center font-semibold transition-all"
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
        <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1">
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            {formattedDate} · {location.split(',')[0]}
          </p>
          {isConfirmed && (
            <>
              <div className="rounded-pill bg-sage/20 text-sage mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
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
                <div className="bg-sunlight/20 ring-sunlight/40 mt-3 rounded-2xl px-4 py-3 text-sm ring-1">
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
                    className="rounded-pill bg-terracotta press px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf6c52]"
                    data-testid="rsvp-card-edit-link"
                  >
                    Edit attendance &amp; dishes
                  </button>
                  <Link
                    href={`/my-events/${existingRsvp.id}/confirmation`}
                    className="rounded-pill border-border bg-card text-foreground press hover:border-foreground border px-4 py-2.5 text-center text-sm font-semibold transition-all"
                  >
                    View confirmation
                  </Link>
                  <button
                    onClick={handleDecline}
                    disabled={isSubmitting}
                    className="rounded-pill text-muted-foreground hover:text-destructive px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Can&apos;t make it'}
                  </button>
                </div>
              )}
            </>
          )}
          {isDeclined && (
            <>
              <div className="rounded-pill bg-secondary text-muted-foreground mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
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
                  className="rounded-pill bg-terracotta shadow-soft press mt-5 w-full px-5 py-3 font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
                >
                  {isFull ? 'Event is full' : 'RSVP again'}
                </button>
              )}
            </>
          )}
          {isWaitlisted && (
            <>
              <div className="rounded-pill bg-sunlight/30 mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#a07c2f]">
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

  // FPP-89: the bottom sheet is no longer the primary RSVP entry
  // point on the event page. The invitation wizard is. For a
  // logged-in user with no RSVP we surface two informational
  // variants:
  //   - has a pending invitation → point them at their invitation
  //     email (the PendingInvitationsCard above already lists it)
  //   - no invitation → "wait for the host to send one"
  // The "Can't make it" decline path stays because it writes a
  // DECLINED RSVP without an invitation, mirroring the prior
  // behavior so users without a household can still opt out.
  if (!existingRsvp && !isPast) {
    return (
      <>
        <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1">
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            {formattedDate} · {location.split(',')[0]}
          </p>
          <h3 className="font-display text-foreground mt-2 text-2xl font-semibold">
            {hasPendingInvitation ? 'RSVP via your invitation' : 'Waiting on your invitation'}
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {hasPendingInvitation
              ? 'The host has invited you — open the invitation link from your email or text to RSVP.'
              : 'The host will send you a personal invitation link when RSVPs open. We do not accept RSVPs from this page.'}
          </p>
          {hasPendingInvitation && (
            <Link
              href="/my-events"
              className="rounded-pill border-border bg-card text-foreground press hover:border-foreground mt-5 block w-full border px-5 py-3 text-center text-sm font-semibold transition-all"
              data-testid="rsvp-card-open-invitations"
            >
              Open my invitations
            </Link>
          )}
          {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
          {isRsvpOpen && (
            <button
              onClick={handleDecline}
              disabled={isSubmitting}
              className="rounded-pill text-muted-foreground hover:text-destructive mt-3 w-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              data-testid="rsvp-card-decline-link"
            >
              {isSubmitting ? 'Updating...' : "Can't make it"}
            </button>
          )}
        </div>
      </>
    );
  }
}
