'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRsvpFormState, useRsvpMutation } from '~/hooks';
import { RsvpAttending } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import Modal from '~/components/ui/Modal';
import type { ExistingRsvp } from './types';

interface RsvpBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName?: string;
  maxCapacity: number | null;
  currentAttending: number;
  onConfirmed?: (rsvpId: string) => void;
  // Accepted for backwards compat with the pre-per-member RSVP flow.
  // The sheet fetches its own roster + attendance via useRsvpFormState;
  // this prop is no longer used for hydration but is kept so existing
  // call sites (events page, sticky bar) compile without changes.
  existingRsvp?: ExistingRsvp | null;
}

interface AttendanceDraft {
  householdMemberId: string | null;
  memberName: string;
  memberAge: number | null;
  attending: RsvpAttending;
}

const ATTENDANCE_OPTIONS: RsvpAttending[] = [
  RsvpAttending.YES,
  RsvpAttending.NO,
  RsvpAttending.MAYBE,
];

function defaultAttendanceForNewMember(
  memberId: string,
  name: string,
  age: number | null,
): AttendanceDraft {
  return {
    householdMemberId: memberId,
    memberName: name,
    memberAge: age,
    attending: RsvpAttending.YES,
  };
}

function buildInitialDrafts(
  members: Array<{ id: string; name: string; age: number | null }>,
  attendances: Array<{
    householdMemberId: string | null;
    memberNameSnapshot: string;
    memberAgeSnapshot: number | null;
    attending: RsvpAttending;
  }>,
): AttendanceDraft[] {
  const existing = new Map<string, AttendanceDraft>();
  for (const att of attendances) {
    const key =
      att.householdMemberId ?? `name:${att.memberNameSnapshot}:${att.memberAgeSnapshot ?? ''}`;
    existing.set(key, {
      householdMemberId: att.householdMemberId,
      memberName: att.memberNameSnapshot,
      memberAge: att.memberAgeSnapshot,
      attending: att.attending,
    });
  }

  const next: AttendanceDraft[] = members.map((m) => {
    const prior = existing.get(m.id);
    if (prior) {
      return {
        householdMemberId: m.id,
        memberName: m.name,
        memberAge: m.age,
        attending: prior.attending,
      };
    }
    return defaultAttendanceForNewMember(m.id, m.name, m.age);
  });

  // Carry over historical rows whose member has been soft-deleted.
  // The server preserves these so the confirmation page still has
  // history; we just surface them so the user can flip them to NO
  // if they want them to disappear.
  for (const [, draft] of existing) {
    if (!draft.householdMemberId) {
      next.push(draft);
    }
  }
  return next;
}

export function RsvpBottomSheet({
  isOpen,
  onClose,
  eventId,
  eventName,
  maxCapacity,
  currentAttending,
  onConfirmed,
  existingRsvp: _existingRsvp,
}: RsvpBottomSheetProps) {
  const router = useRouter();
  const { confirm, decline } = useRsvpMutation();
  // Only query the form state when the sheet is open so we do not
  // start a fetch when the parent has not asked for it.
  const {
    data: formState,
    isLoading,
    error: fetchError,
    refetch,
  } = useRsvpFormState(isOpen ? eventId : null);

  const [drafts, setDrafts] = useState<AttendanceDraft[]>([]);
  const [newMember, setNewMember] = useState({ name: '', age: '' });
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDietary, setShowDietary] = useState(false);
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'confirmed'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedRsvpId, setConfirmedRsvpId] = useState<string | null>(null);
  // Tracks whether the user has begun editing. We only seed from
  // the server snapshot when the form is empty, so a refetch that
  // races with the confirm mutation cannot overwrite in-progress
  // edits.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset everything on close so a fresh open does not inherit
      // a stale snapshot from a previous event. This is the
      // intended use of setState in an effect: a state transition
      // triggered by a prop change, not a render-time cascading
      // update.
      /* eslint-disable react-hooks/set-state-in-effect */
      setPhase('form');
      setDrafts([]);
      setNewMember({ name: '', age: '' });
      setShowAddMember(false);
      setShowDietary(false);
      setDietaryNotes('');
      setSubmitError(null);
      setConfirmedRsvpId(null);
      setHydrated(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  // Seed drafts from the server snapshot only on the first load.
  // Subsequent refetches (which the confirm/decline mutations
  // trigger) must not clobber edits the user has made in between.
  useEffect(() => {
    if (!isOpen || hydrated) return;
    if (!formState) return;
    // setState in effect: we are hydrating local form state from a
    // server snapshot that arrived after the form opened. The
    // hydration is gated on `hydrated` so it never runs twice.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDrafts(buildInitialDrafts(formState.members, formState.rsvp?.memberAttendances ?? []));
    setDietaryNotes(formState.rsvp?.dietaryNotes ?? '');
    setShowDietary(Boolean(formState.rsvp?.dietaryNotes));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, hydrated, formState]);

  const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;
  const yesCount = useMemo(
    () => drafts.filter((d) => d.attending === RsvpAttending.YES).length,
    [drafts],
  );

  const updateAttendance = (index: number, value: RsvpAttending) => {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, attending: value } : d)));
  };

  const removeMember = (index: number) => {
    setDrafts((current) => current.filter((_, i) => i !== index));
  };

  const addAdHocMember = () => {
    const name = newMember.name.trim();
    if (!name) return;
    if (newMember.age.trim() === '') {
      setSubmitError(null);
      setDrafts((current) => [
        ...current,
        {
          householdMemberId: null,
          memberName: name,
          memberAge: null,
          attending: RsvpAttending.YES,
        },
      ]);
      setNewMember({ name: '', age: '' });
      setShowAddMember(false);
      return;
    }
    const ageValue = Number(newMember.age);
    if (Number.isNaN(ageValue) || ageValue < 0 || ageValue > 120) {
      setSubmitError('Age must be between 0 and 120.');
      return;
    }
    setSubmitError(null);
    setDrafts((current) => [
      ...current,
      {
        householdMemberId: null,
        memberName: name,
        memberAge: ageValue,
        attending: RsvpAttending.YES,
      },
    ]);
    setNewMember({ name: '', age: '' });
    setShowAddMember(false);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    if (drafts.length === 0) {
      setSubmitError('Add at least one household member before confirming.');
      setIsSubmitting(false);
      return;
    }
    if (yesCount === 0) {
      setSubmitError(
        'At least one member must be marked as going. Use "Can\u2019t make it" below to decline.',
      );
      setIsSubmitting(false);
      return;
    }
    try {
      const result = await confirm.mutateAsync({
        eventId,
        dietaryNotes: dietaryNotes.trim() || undefined,
        memberAttendances: drafts.map((d) => ({
          householdMemberId: d.householdMemberId,
          memberName: d.memberName,
          memberAge: d.memberAge,
          attending: d.attending,
        })),
      });
      setConfirmedRsvpId(result.id);
      setPhase('confirmed');
      if (onConfirmed) {
        onConfirmed(result.id);
      }
      setTimeout(() => {
        onClose();
        router.push(`/my-events/${result.id}/confirmation`);
      }, 1200);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await decline.mutateAsync({ eventId });
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show a retryable error state when the roster fetch fails.
  if (fetchError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg" variant="bottom-sheet">
        <div className="py-8 text-center">
          <div className="bg-destructive/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
            <svg
              className="text-destructive h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14"
              />
            </svg>
          </div>
          <h3 className="font-display text-foreground mt-6 text-2xl font-semibold">
            We couldn&apos;t load your household
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Check your connection and try again. We won&apos;t submit until your roster is ready.
          </p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="rounded-pill bg-terracotta shadow-soft press mt-6 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf6c52]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill text-muted-foreground hover:text-foreground mt-2 block w-full px-5 py-2.5 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  // Block on the initial roster fetch. We deliberately do not show
  // the empty-roster "add a guest" UI during this window so the
  // user cannot submit an empty attendance list before the server
  // data arrives.
  if (isLoading || !formState) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg" variant="bottom-sheet">
        <div className="py-8 text-center" aria-busy="true">
          <div className="bg-secondary mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full" />
          <h3 className="font-display text-foreground mt-6 text-2xl font-semibold">
            Loading your household&hellip;
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Pulling your household roster and any saved attendance.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" variant="bottom-sheet">
      {phase === 'form' ? (
        <>
          <div className="text-center md:text-left">
            <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
              {isFull ? 'Join the waitlist' : 'RSVP'}
            </p>
            <h3 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
              Who&apos;s coming?
            </h3>
            <p className="text-muted-foreground mt-2 text-base">
              {eventName
                ? `Mark attendance for each person in your household for ${eventName}.`
                : 'Mark attendance for each person in your household.'}
            </p>
          </div>

          {drafts.length === 0 ? (
            <div className="bg-sunlight/20 mt-8 rounded-2xl p-6 text-center">
              <p className="text-foreground text-base">
                Your household has no members yet. Add one below to RSVP.
              </p>
            </div>
          ) : (
            <ul className="mt-8 space-y-2">
              {drafts.map((draft, index) => (
                <li
                  key={`${draft.householdMemberId ?? draft.memberName}-${index}`}
                  className="border-border bg-card/40 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate font-medium">{draft.memberName}</p>
                    {draft.memberAge !== null && (
                      <p className="text-muted-foreground text-xs">{draft.memberAge} yrs</p>
                    )}
                  </div>
                  <select
                    aria-label={`Attendance for ${draft.memberName}`}
                    value={draft.attending}
                    onChange={(e) => updateAttendance(index, e.target.value as RsvpAttending)}
                    className="border-border bg-card text-foreground focus:border-foreground min-h-10 rounded-2xl border px-3 py-2 text-sm focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                  >
                    {ATTENDANCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {attendingLabel(opt)}
                      </option>
                    ))}
                  </select>
                  {!draft.householdMemberId && (
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="text-muted-foreground hover:text-destructive text-xs"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {showAddMember ? (
            <div className="bg-secondary/40 mt-4 rounded-2xl p-4">
              <h4 className="text-foreground text-sm font-semibold">Add a guest</h4>
              <p className="text-muted-foreground mt-1 text-xs">
                Guests are saved on this RSVP only. Add them to your household to keep them for
                future events.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Name"
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground rounded-2xl border px-3 py-2 text-sm focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={newMember.age}
                  onChange={(e) => setNewMember({ ...newMember, age: e.target.value })}
                  placeholder="Age"
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground rounded-2xl border px-3 py-2 text-sm focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={addAdHocMember}
                  disabled={!newMember.name.trim()}
                  className="rounded-pill bg-terracotta press px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMember({ name: '', age: '' });
                    setSubmitError(null);
                  }}
                  className="rounded-pill text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="text-terracotta decoration-terracotta/30 hover:decoration-terracotta mt-3 text-sm font-semibold underline underline-offset-4 transition-colors"
            >
              + Add a one-time guest
            </button>
          )}

          <p className="text-muted-foreground mt-5 text-xs">
            {yesCount === 1 ? '1 person' : `${yesCount} people`} going
          </p>

          <div className="mt-3">
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

          {submitError && (
            <p className="bg-destructive/10 text-destructive ring-destructive/30 mt-4 rounded-2xl px-4 py-3 text-sm ring-1">
              {submitError}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={isSubmitting || yesCount === 0}
            className="rounded-pill bg-terracotta shadow-soft press mt-7 w-full px-6 py-3.5 font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving...'
              : isFull
                ? `Join waitlist for ${yesCount}`
                : `Confirm ${yesCount} ${yesCount === 1 ? 'guest' : 'guests'}`}
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
          {confirmedRsvpId && (
            <p className="text-muted-foreground mt-1 text-xs">Redirecting to your confirmation…</p>
          )}
        </div>
      )}
    </Modal>
  );
}
