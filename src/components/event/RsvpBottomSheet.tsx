'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRsvpMutation } from '~/hooks';
import Modal from '~/components/ui/Modal';
import type { ExistingRsvp } from './types';

const CLOSE_ANIMATION_MS = 200;
const SUCCESS_DWELL_MS = 1500;

function getInitialState(existingRsvp: ExistingRsvp | null | undefined) {
  return {
    adults: existingRsvp && existingRsvp.headcount > 0 ? existingRsvp.headcount : 1,
    kids: 0,
    dietaryNotes: existingRsvp?.dietaryNotes ?? '',
    showDietary: Boolean(existingRsvp?.dietaryNotes),
  };
}

interface RsvpBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName?: string;
  maxCapacity: number | null;
  currentAttending: number;
  existingRsvp?: ExistingRsvp | null;
}

export function RsvpBottomSheet({
  isOpen,
  onClose,
  eventId,
  eventName,
  maxCapacity,
  currentAttending,
  existingRsvp,
}: RsvpBottomSheetProps) {
  const { confirm, decline } = useRsvpMutation();
  const router = useRouter();
  const initial = getInitialState(existingRsvp);
  const [adults, setAdults] = useState(initial.adults);
  const [kids, setKids] = useState(initial.kids);
  const [dietaryNotes, setDietaryNotes] = useState(initial.dietaryNotes);
  const [showDietary, setShowDietary] = useState(initial.showDietary);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'confirmed'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOpenRef = useRef(isOpen);
  const pendingErrorRef = useRef<string | null>(null);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && pendingErrorRef.current) {
      setError(pendingErrorRef.current);
      pendingErrorRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- error is not in deps; this clears a stale error from a late rejection so the next reopen does not show it
      setError(null);
      const timeout = setTimeout(() => {
        const next = getInitialState(existingRsvp);
        setPhase('form');
        setAdults(next.adults);
        setKids(next.kids);
        setDietaryNotes(next.dietaryNotes);
        setShowDietary(next.showDietary);
      }, CLOSE_ANIMATION_MS);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, existingRsvp]);

  const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;
  const total = adults + kids;
  const isUpdating = existingRsvp?.status === 'CONFIRMED' || existingRsvp?.status === 'WAITLISTED';

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    pendingErrorRef.current = null;
    try {
      await confirm.mutateAsync({
        eventId,
        headcount: total,
        dietaryNotes: dietaryNotes.trim() || undefined,
      });
      router.refresh();
      if (!isOpenRef.current) return;
      setPhase('confirmed');
      setTimeout(() => {
        if (isOpenRef.current) onClose();
      }, SUCCESS_DWELL_MS);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (!isOpenRef.current) {
        pendingErrorRef.current = message;
        return;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    setError(null);
    pendingErrorRef.current = null;
    try {
      await decline.mutateAsync({ eventId });
      router.refresh();
      if (!isOpenRef.current) return;
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (!isOpenRef.current) {
        pendingErrorRef.current = message;
        return;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" variant="bottom-sheet">
      {phase === 'form' ? (
        <>
          <div className="text-center md:text-left">
            <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
              {isUpdating ? 'Update your RSVP' : isFull ? 'Join the waitlist' : 'RSVP'}
            </p>
            <h3 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
              {isUpdating ? 'Update your party' : "Who's coming?"}
            </h3>
            <p className="text-muted-foreground mt-2 text-base">
              {isUpdating
                ? 'Adjust your headcount or dietary note. We already have you on the list.'
                : eventName
                  ? `Let us know how many plates to set for ${eventName}.`
                  : 'Let us know how many places to set at the table.'}
            </p>
          </div>

          <div className="divide-border/60 mt-8 space-y-2 divide-y">
            <Counter label="Adults" hint="Age 13+" value={adults} onChange={setAdults} min={1} />
            <Counter label="Children" hint="Ages 2–12" value={kids} onChange={setKids} min={0} />
          </div>

          <div className="mt-6">
            {!showDietary ? (
              <button
                onClick={() => setShowDietary(true)}
                className="text-terracotta decoration-terracotta/30 hover:decoration-terracotta text-sm font-semibold underline underline-offset-4 transition-colors"
              >
                + Add a dietary note (optional)
              </button>
            ) : (
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Dietary note (optional)
                </label>
                <textarea
                  value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  rows={2}
                  placeholder="Allergies, preferences, etc."
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground block w-full rounded-2xl border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="bg-destructive/10 text-destructive ring-destructive/30 mt-4 rounded-2xl px-4 py-3 text-sm ring-1">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={isSubmitting || total === 0}
            className="rounded-pill bg-terracotta shadow-soft press mt-7 w-full px-6 py-3.5 font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving...'
              : isUpdating
                ? `Save changes for ${total}`
                : isFull
                  ? `Join waitlist for ${total}`
                  : `Confirm ${total} ${total === 1 ? 'guest' : 'guests'}`}
          </button>

          <button
            onClick={handleDecline}
            disabled={isSubmitting}
            className="rounded-pill text-muted-foreground hover:text-destructive mt-3 w-full px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Can&apos;t make it
          </button>
        </>
      ) : (
        <div className="py-8 text-center">
          <div className="bg-sage/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
            <svg
              className="text-sage h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-display text-foreground mt-6 text-3xl font-medium tracking-tight">
            You&apos;re on the list!
          </h3>
          <p className="text-muted-foreground mt-2 text-base">
            We can&apos;t wait to see you and the family.
          </p>
        </div>
      )}
    </Modal>
  );
}

function Counter({
  label,
  hint,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between py-5 first:pt-0">
      <div>
        <h4 className="font-display text-foreground text-lg font-semibold">{label}</h4>
        {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="border-border text-muted-foreground hover:border-foreground hover:text-foreground disabled:hover:border-border disabled:hover:text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full border transition-all disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        </button>
        <span className="font-display text-foreground w-8 text-center text-2xl font-semibold">
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          className="border-foreground bg-foreground text-background hover:bg-foreground/90 flex h-11 w-11 items-center justify-center rounded-full border transition-all"
          aria-label={`Increase ${label}`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
