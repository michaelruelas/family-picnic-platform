'use client';

import { useState } from 'react';
import { useRsvpMutation } from '~/hooks';
import { RsvpBottomSheet } from './RsvpBottomSheet';

interface EventStickyBarProps {
  eventId: string;
  eventDate: Date;
  location: string;
  isLoggedIn: boolean;
  isPast: boolean;
  rsvpDeadline: string | null;
  maxCapacity: number | null;
  currentAttending: number;
  // Kept as a free-form field so the parent (events page) can pass
  // through whatever shape it already has. The sticky bar only reads
  // `status` to decide whether to show the "RSVP'd" badge.
  existingRsvp: { status: string } | null;
  /**
   * Per-event fee configuration. Forwarded to the bottom sheet so
   * mobile users see the live fee line before confirming. Null when
   * the event is free or has no fee config.
   */
  registrationFeeConfig?: { amountCents: number; minAge: number; currency: string } | null;
}

export function EventStickyBar({
  eventId,
  eventDate,
  location,
  isLoggedIn,
  isPast,
  rsvpDeadline,
  maxCapacity,
  currentAttending,
  existingRsvp,
  registrationFeeConfig,
}: EventStickyBarProps) {
  const { decline } = useRsvpMutation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);

  if (isPast) return null;

  const formattedDate = eventDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const shortLocation = location.split(',')[0];
  const isRsvpOpen = !isPast && (!rsvpDeadline || new Date(rsvpDeadline) > new Date());
  const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;
  const isConfirmed = existingRsvp?.status === 'CONFIRMED';
  const isDeclined = existingRsvp?.status === 'DECLINED';
  // FPP-35: surface the decline path on the sticky bar too so mobile
  // users who haven't RSVPed can decline in one tap. Disabled when
  // the decline mutation is in flight or RSVP is closed.
  const canDecline = isRsvpOpen && !isConfirmed && !isDeclining;

  if (!isLoggedIn) {
    return (
      <div className="border-border/60 bg-background/85 fixed right-0 bottom-0 left-0 z-30 border-t p-4 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-foreground text-lg font-semibold">{formattedDate}</p>
            <p className="text-muted-foreground truncate text-sm">{shortLocation}</p>
          </div>
          <a
            href="/login"
            className="rounded-pill bg-foreground text-background press px-6 py-3 text-sm font-semibold"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const handleStickyDecline = async () => {
    setIsDeclining(true);
    setDeclineError(null);
    try {
      await decline.mutateAsync({ eventId });
    } catch (err) {
      setDeclineError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <>
      <div className="border-border/60 bg-background/85 fixed right-0 bottom-0 left-0 z-30 border-t p-4 shadow-[0_-10px_30px_rgba(43,45,66,0.06)] backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-foreground text-lg font-semibold">{formattedDate}</p>
            <p className="text-muted-foreground truncate text-sm">{shortLocation}</p>
          </div>
          {isConfirmed ? (
            <div className="rounded-pill bg-sage/20 text-sage inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold">
              <span>✓</span> RSVP&apos;d
            </div>
          ) : isDeclined ? (
            <div className="rounded-pill bg-secondary text-muted-foreground inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold">
              Declined
            </div>
          ) : (
            <button
              onClick={() => setIsSheetOpen(true)}
              disabled={!isRsvpOpen}
              className="rounded-pill bg-terracotta shadow-soft press px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
            >
              {isRsvpOpen ? (isFull ? 'Join Waitlist' : 'RSVP Now') : 'RSVP Closed'}
            </button>
          )}
        </div>
        {!isConfirmed && !isDeclined && isRsvpOpen && (
          <div className="mx-auto mt-2 flex max-w-md items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleStickyDecline}
              disabled={!canDecline}
              className="text-muted-foreground hover:text-destructive rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              data-testid="rsvp-sticky-decline-link"
            >
              {isDeclining ? 'Updating...' : "Can't make it"}
            </button>
          </div>
        )}
        {declineError && (
          <p className="text-destructive mx-auto mt-1 max-w-md text-center text-xs">
            {declineError}
          </p>
        )}
      </div>

      <RsvpBottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        eventId={eventId}
        maxCapacity={maxCapacity}
        currentAttending={currentAttending}
        registrationFeeConfig={registrationFeeConfig}
      />
    </>
  );
}
