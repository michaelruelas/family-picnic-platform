'use client';

import { useState } from 'react';
import { useRsvpMutation } from '~/hooks';
import { RSVPStatus } from '~/lib/generated/enums';
import { RsvpBottomSheet } from './RsvpBottomSheet';

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
  existingRsvp: {
    status: RSVPStatus;
    headcount: number;
    dietaryNotes: string | null;
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
  existingRsvp,
}: EventRsvpCardProps) {
  const { confirm, decline } = useRsvpMutation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headcount, setHeadcount] = useState(existingRsvp?.headcount || 1);
  const [dietaryNotes, setDietaryNotes] = useState(existingRsvp?.dietaryNotes || '');

  const isRsvpOpen = !isPast && (!rsvpDeadline || new Date(rsvpDeadline) > new Date());
  const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const handleSaveEdit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await confirm.mutateAsync({
        eventId,
        headcount,
        dietaryNotes: dietaryNotes || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  if (existingRsvp && !isEditing) {
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
              {existingRsvp.dietaryNotes && (
                <div className="bg-sunlight/20 ring-sunlight/40 mt-4 rounded-2xl px-4 py-3 text-sm ring-1">
                  <span className="text-foreground font-semibold">Dietary note:</span>{' '}
                  <span className="text-foreground/80">{existingRsvp.dietaryNotes}</span>
                </div>
              )}
              {isRsvpOpen && (
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-pill border-border bg-card text-foreground press hover:border-foreground border px-4 py-2.5 text-sm font-semibold transition-all"
                  >
                    Edit RSVP
                  </button>
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
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1">
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
          {formattedDate} · {location.split(',')[0]}
        </p>
        <h3 className="font-display text-foreground mt-2 text-2xl font-semibold">
          Join the gathering
        </h3>
        {isFull ? (
          <>
            <p className="text-muted-foreground mt-2 text-sm">
              This gathering is full, but you can join the waitlist.
            </p>
            <button
              onClick={() => setIsSheetOpen(true)}
              disabled={!isRsvpOpen}
              className="rounded-pill bg-terracotta shadow-soft press mt-5 w-full px-5 py-3 font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
            >
              {isRsvpOpen ? 'Join the waitlist' : 'RSVP closed'}
            </button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mt-2 text-sm">
              {spotsRemaining !== null
                ? `${spotsRemaining} ${spotsRemaining === 1 ? 'spot' : 'spots'} left`
                : 'Save your spot in under a minute.'}
            </p>
            <button
              onClick={() => setIsSheetOpen(true)}
              disabled={!isRsvpOpen}
              className="rounded-pill bg-terracotta shadow-soft press mt-5 w-full px-5 py-3 font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
            >
              {isRsvpOpen ? 'RSVP Now' : 'RSVP closed'}
            </button>
          </>
        )}
        {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
      </div>

      {isEditing && (
        <div className="bg-card shadow-card ring-border/60 mt-4 rounded-3xl p-7 ring-1">
          <h3 className="font-display text-foreground text-xl font-semibold">Edit your RSVP</h3>
          {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Number of people
              </label>
              <select
                value={headcount}
                onChange={(e) => setHeadcount(Number(e.target.value))}
                className="border-border bg-card text-foreground focus:border-foreground block min-h-12 w-full rounded-2xl border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'person' : 'people'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Dietary notes (optional)
              </label>
              <textarea
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                placeholder="Allergies, preferences, etc."
                rows={3}
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground block w-full rounded-2xl border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="rounded-pill bg-sage shadow-soft press flex-1 px-4 py-2.5 font-semibold text-white transition-all hover:bg-[#6fa18a] disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setHeadcount(existingRsvp?.headcount || 1);
                  setDietaryNotes(existingRsvp?.dietaryNotes || '');
                  setError(null);
                }}
                disabled={isSubmitting}
                className="rounded-pill text-muted-foreground hover:text-foreground px-4 py-2.5 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <RsvpBottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        eventId={eventId}
        eventName={eventName}
        maxCapacity={maxCapacity}
        currentAttending={currentAttending}
      />
    </>
  );
}
