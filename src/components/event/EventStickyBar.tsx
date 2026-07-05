'use client';

import { useState } from 'react';
import { RSVPStatus } from '~/lib/generated/enums';
import { RsvpBottomSheet } from './RsvpBottomSheet';

interface EventStickyBarProps {
  eventId: string;
  eventName: string;
  eventDate: Date;
  location: string;
  isLoggedIn: boolean;
  isPast: boolean;
  rsvpDeadline: string | null;
  maxCapacity: number | null;
  currentAttending: number;
  existingRsvp: {
    status: RSVPStatus;
    headcount: number;
    dietaryNotes: string | null;
  } | null;
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
}: EventStickyBarProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
      </div>

      <RsvpBottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        eventId={eventId}
        maxCapacity={maxCapacity}
        currentAttending={currentAttending}
      />
    </>
  );
}
