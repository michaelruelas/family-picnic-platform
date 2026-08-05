'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useHouseholdNameMutation, useRsvpFormState, useRsvpMutation } from '~/hooks';
import { RsvpAttending } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import { householdNameSchema, HOUSEHOLD_NAME_MAX } from '~/lib/schemas/household';
import { calculateFee, type FeeAttendee } from '~/lib/fee';
import { formatAmount } from '~/lib/currency';
import Modal from '~/components/ui/Modal';
import PotluckEditor from './PotluckEditor';
import type { ExistingRsvp } from './types';

interface RsvpBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName?: string;
  maxCapacity: number | null;
  currentAttending: number;
  onConfirmed?: (rsvpId: string) => void;
  /**
   * Per-event fee configuration. When null, the event is free and
   * the live fee line is omitted. The sheet re-computes the total
   * on every attendance change so the user sees the dollar figure
   * before they hit Confirm.
   */
  registrationFeeConfig?: { amountCents: number; minAge: number; currency: string } | null;
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
  registrationFeeConfig,
  existingRsvp: _existingRsvp,
}: RsvpBottomSheetProps) {
  const { confirm, decline } = useRsvpMutation();
  const { updateName } = useHouseholdNameMutation();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  // FPP-21: the bottom sheet now hosts a two-tab editor so the
  // user can manage potluck dishes from the same surface that
  // collects attendance. The Dishes tab is enabled only after the
  // RSVP is confirmed; the Attendance tab is the default. After a
  // successful confirm we switch to the Dishes tab so the user
  // can immediately claim a slot. Deep link: when the URL is
  // /events/[id]?rsvpOpen=1#dishes we land on the Dishes tab.
  type Tab = 'attendance' | 'dishes';
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [showSuccess, setShowSuccess] = useState(false);
  const searchParams = useSearchParams();
  // FPP-80: household name is editable from the RSVP form. The
  // sheet seeds the input from the server snapshot and only
  // commits a rename to `household.update` when the trimmed value
  // differs from the stored one. When the caller has no household
  // (formState.householdName is null) the input is hidden because
  // there is nothing to rename.
  const [householdName, setHouseholdName] = useState('');
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
      setDrafts([]);
      setNewMember({ name: '', age: '' });
      setShowAddMember(false);
      setShowDietary(false);
      setDietaryNotes('');
      setSubmitError(null);
      setHouseholdName('');
      setHydrated(false);
      setActiveTab('attendance');
      setShowSuccess(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  // FPP-21: honor the ?rsvpOpen=1#dishes deep link from the
  // per-event potluck page. We only consult the search params on
  // mount so the user's manual tab picks are not overridden on
  // every render. The hash anchor (#dishes) is read from
  // window.location because Next.js does not expose it on the
  // router's search params.
  useEffect(() => {
    if (!isOpen) return;
    const rsvpOpen = searchParams?.get('rsvpOpen') === '1';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (rsvpOpen && hash === '#dishes') {
      /* eslint-disable react-hooks/set-state-in-effect */
      setActiveTab('dishes');
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
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
    setHouseholdName(formState.householdName ?? '');
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, hydrated, formState]);

  const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;
  const yesCount = useMemo(
    () => drafts.filter((d) => d.attending === RsvpAttending.YES).length,
    [drafts],
  );

  // Live fee total. Recomputed on every draft change so the user
  // sees the price move as they flip members to YES / NO. Hidden
  // when the event has no fee configured.
  const feeBreakdown = useMemo(() => {
    if (!registrationFeeConfig || registrationFeeConfig.amountCents <= 0) {
      return { amountCents: 0, qualifyingAttendees: 0 };
    }
    const feeInput: FeeAttendee[] = drafts.map((d) => ({
      attending: d.attending,
      memberAge: d.memberAge,
    }));
    return calculateFee(feeInput, {
      amountCents: registrationFeeConfig.amountCents,
      minAge: registrationFeeConfig.minAge,
    });
  }, [drafts, registrationFeeConfig]);
  const showFeeLine = registrationFeeConfig !== null && feeBreakdown.amountCents > 0;
  const feeCurrency = registrationFeeConfig?.currency ?? 'usd';

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
    // The form is rendered behind a `if (!formState) return` gate,
    // so `formState` is always non-null here. Narrow it once at
    // the top so the rest of the function can use `formState`
    // without an alias.
    if (!formState) {
      setIsSubmitting(false);
      return;
    }
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
      // FPP-80: when the caller belongs to a household, save any
      // rename through `household.update` before the RSVP goes
      // through. We use the same household-name Zod schema that the
      // profile path uses so the empty-name rejection message is
      // identical ("Household name is required"). Skipping the call
      // when the value is unchanged avoids a needless round-trip.
      if (formState.householdName !== null) {
        const trimmed = householdName.trim();
        const parsed = householdNameSchema.safeParse(trimmed);
        if (!parsed.success) {
          setSubmitError(parsed.error.issues[0]?.message ?? 'Household name is required');
          setIsSubmitting(false);
          return;
        }
        if (parsed.data !== formState.householdName) {
          await updateName.mutateAsync({
            id: formState.householdId,
            name: parsed.data,
          });
        }
      }
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
      if (onConfirmed) {
        onConfirmed(result.id);
      }
      // FPP-21: stay on the sheet and switch to the Dishes tab so
      // the user can immediately claim a dish. The success banner
      // confirms the RSVP without forcing a redirect.
      setShowSuccess(true);
      setActiveTab('dishes');
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
      {/*
        FPP-21: two-tab editor. The Attendance tab collects the
        household roster; the Dishes tab embeds PotluckEditor so
        the user can claim a slot without leaving the sheet. The
        Dishes tab is enabled only after the RSVP is confirmed.
      */}
      <div
        className="border-border bg-secondary/40 mx-auto mb-5 flex w-full max-w-md rounded-2xl border p-1"
        role="tablist"
        aria-label="RSVP sections"
        data-testid="rsvp-tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'attendance'}
          data-testid="rsvp-tab-attendance"
          onClick={() => setActiveTab('attendance')}
          className={
            activeTab === 'attendance'
              ? 'bg-card text-foreground flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors'
              : 'text-muted-foreground hover:text-foreground flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors'
          }
        >
          Attendance
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'dishes'}
          data-testid="rsvp-tab-dishes"
          onClick={() => setActiveTab('dishes')}
          className={
            activeTab === 'dishes'
              ? 'bg-card text-foreground flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors'
              : 'text-muted-foreground hover:text-foreground flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors'
          }
        >
          Dishes
        </button>
      </div>

      {showSuccess && (
        <div
          className="bg-sage/15 ring-sage/30 mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1"
          data-testid="rsvp-success-banner"
          role="status"
        >
          <span className="bg-sage/30 text-sage flex h-7 w-7 items-center justify-center rounded-full font-bold">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground font-semibold">You&apos;re on the list!</p>
            <p className="text-muted-foreground text-xs">Pick a dish below or close the sheet.</p>
          </div>
        </div>
      )}

      {activeTab === 'attendance' ? (
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

          {/*
            FPP-80: household name input at the top of the form.
            Hidden when the caller has no household (formState.householdName
            is null) because there is nothing to rename. Saved on
            submit via the same `household.update` procedure as the
            profile path.
          */}
          {formState.householdName !== null && (
            <div className="mt-8" data-testid="rsvp-household-name-field">
              <label
                htmlFor="rsvp-household-name"
                className="text-foreground block text-sm font-medium"
              >
                Household name
              </label>
              <p className="text-muted-foreground mt-1 text-xs">
                Update the name shown on your confirmation and across events.
              </p>
              <input
                id="rsvp-household-name"
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                maxLength={HOUSEHOLD_NAME_MAX}
                autoComplete="off"
                placeholder="e.g. The Garcia Family"
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground mt-3 block w-full rounded-2xl border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
              />
            </div>
          )}

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

          {showFeeLine && (
            <div className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-2xl px-4 py-3 text-sm ring-1">
              <span className="text-foreground font-semibold">
                Registration fee: {formatAmount(feeBreakdown.amountCents, feeCurrency)}
              </span>
              <span className="text-muted-foreground ml-2 text-xs">
                ({feeBreakdown.qualifyingAttendees}{' '}
                {feeBreakdown.qualifyingAttendees === 1 ? 'attendee' : 'attendees'} at{' '}
                {formatAmount(
                  registrationFeeConfig?.amountCents ?? 0,
                  registrationFeeConfig?.currency ?? 'usd',
                )}
                )
              </span>
            </div>
          )}

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

          <Link
            href={`/events/${eventId}/potluck`}
            onClick={onClose}
            className="text-terracotta decoration-terracotta/30 hover:decoration-terracotta mt-3 block text-center text-sm font-semibold underline underline-offset-4"
            data-testid="rsvp-form-potluck-link"
          >
            See who is bringing what →
          </Link>

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
        <div data-testid="rsvp-dishes-tab">
          {!formState.rsvp ? (
            <div className="py-6 text-center">
              <p className="text-muted-foreground text-sm">Loading your RSVP…</p>
            </div>
          ) : formState.rsvp.status === 'CONFIRMED' ? (
            <PotluckEditor eventId={eventId} hasRsvp isRsvpConfirmed />
          ) : (
            <div className="py-6 text-center">
              <div className="text-4xl">🍽️</div>
              <h3 className="font-display text-foreground mt-4 text-2xl font-semibold">
                RSVP first
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Confirm your attendance on the Attendance tab to claim potluck dishes.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('attendance')}
                className="rounded-pill bg-terracotta press mt-5 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf6c52]"
              >
                Go to Attendance
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
