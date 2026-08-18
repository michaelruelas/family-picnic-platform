'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useHouseholdMemberNameMutation,
  useHouseholdNameMutation,
  useRsvpFormState,
  useRsvpMutation,
  useUserProfileMutation,
} from '~/hooks';
import { trpc } from '~/lib/trpc-client';
import { RsvpAttending } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import { ATTENDEE_NAME_MAX, attendeeNameSchema } from '~/lib/schemas/attendee-name';
import { diffContact, rsvpContactSchema } from '~/lib/schemas/rsvp-contact';
import { householdNameSchema, HOUSEHOLD_NAME_MAX } from '~/lib/schemas/household';
import { calculateFee, type FeeAttendee } from '~/lib/fee';
import { formatAmount } from '~/lib/currency';
import Modal from '~/components/ui/Modal';
import PaymentBlock, { type PaymentChoice } from '~/components/payment/PaymentBlock';
import { usePhoneInput } from '~/hooks/usePhoneInput';
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
  /** Stable key for React list rendering — never changes after creation */
  draftKey: string;
  householdMemberId: string | null;
  memberName: string;
  memberAge: number | null;
  attending: RsvpAttending;
  originalMemberName: string | null;
  /**
   * FPP-107: age as it was when the row hydrated from the server.
   * The submit handler compares the current draft `memberAge`
   * against this baseline to decide whether a household member's
   * age needs a PATCH.
   */
  originalMemberAge: number | null;
  /**
   * When true, this new member will be persisted to the HouseholdMember
   * table so they are retained for future event RSVPs.
   */
  saveToHousehold?: boolean;
}

/** Stable, unique key for a draft — see {@link draftKey} */
function nextDraftKey(): string {
  return crypto.randomUUID();
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
    draftKey: nextDraftKey(),
    householdMemberId: memberId,
    memberName: name,
    memberAge: age,
    attending: RsvpAttending.YES,
    originalMemberName: name,
    originalMemberAge: age,
    saveToHousehold: true,
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
  userName?: string | null,
): AttendanceDraft[] {
  const existing = new Map<string, AttendanceDraft>();
  for (const att of attendances) {
    const key =
      att.householdMemberId ?? `name:${att.memberNameSnapshot}:${att.memberAgeSnapshot ?? ''}`;
    existing.set(key, {
      draftKey: nextDraftKey(),
      householdMemberId: att.householdMemberId,
      memberName: att.memberNameSnapshot,
      memberAge: att.memberAgeSnapshot,
      attending: att.attending,
      originalMemberName: att.householdMemberId ? att.memberNameSnapshot : null,
      originalMemberAge: att.householdMemberId ? att.memberAgeSnapshot : null,
      saveToHousehold: Boolean(att.householdMemberId),
    });
  }

  const next: AttendanceDraft[] = members.map((m) => {
    const prior = existing.get(m.id);
    if (prior) {
      return {
        draftKey: prior.draftKey,
        householdMemberId: m.id,
        memberName: m.name,
        memberAge: m.age,
        attending: prior.attending,
        // Prefer the snapshot over the live name so a later edit to the
        // household member name is not silently overwritten on hydrate.
        // The submit handler compares the draft against this baseline.
        originalMemberName: prior.originalMemberName ?? m.name,
        originalMemberAge: prior.originalMemberAge ?? m.age,
        saveToHousehold: true,
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

  // If no members exist yet, seed with the current user's name so they
  // immediately appear in the attendance list.
  if (next.length === 0 && userName && userName.trim()) {
    next.push({
      draftKey: nextDraftKey(),
      householdMemberId: null,
      memberName: userName.trim(),
      memberAge: null,
      attending: RsvpAttending.YES,
      originalMemberName: null,
      originalMemberAge: null,
      saveToHousehold: true,
    });
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
  const { updateName: updateMemberName } = useHouseholdMemberNameMutation();
  const { updatePreferences } = useUserProfileMutation();
  // Only query the form state when the sheet is open so we do not
  // start a fetch when the parent has not asked for it.
  const {
    data: formState,
    isLoading,
    error: fetchError,
    refetch,
  } = useRsvpFormState(isOpen ? eventId : null);

  const [drafts, setDrafts] = useState<AttendanceDraft[]>([]);
  const [newMember, setNewMember] = useState({ name: '', age: '', saveToHousehold: true });
  const [showAddMember, setShowAddMember] = useState(false);
  // FPP-34: optional phone + comms consent. The phone is a free-form
  // E.164 string the user types; the consent checkbox gates saving a
  // non-empty value. We hydrate both from the formState snapshot so
  // a returning user sees what is already on file.
  //
  // The hook re-formats the raw input as `+1 (xxx) xxx-xxxx` on
  // every keystroke, so the user sees the canonical US shape while
  // we hand the API a clean E.164 (`+15551234567`).
  const phoneField = usePhoneInput('');
  const phone = phoneField.e164;
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // FPP-107: tracks which member row is currently editing their age inline.
  const [editingAgeIndex, setEditingAgeIndex] = useState<number | null>(null);
  const [editingAgeValue, setEditingAgeValue] = useState('');
  // FPP-107: Escape on the inline age input must cancel the edit, not
  // commit an empty value. The flag is a ref so the blur handler (a
  // closure over the render that mounted the input) always reads the
  // latest value even after the keydown state updates land.
  const ageEditCancelledRef = useRef(false);
  // FPP-21: the bottom sheet now hosts a two-tab editor so the
  // user can manage potluck dishes from the same surface that
  // collects attendance. The Potluck tab is enabled only after the
  // RSVP is confirmed; the Attendance tab is the default. After a
  // successful confirm we switch to the Potluck tab so the user
  // can immediately claim a slot. Deep link: when the URL is
  // /events/[id]?rsvpOpen=1#potluck we land on the Potluck tab.
  type Tab = 'attendance' | 'potluck';
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmedInSession, setConfirmedInSession] = useState(false);
  // FPP-123: the fee choice lives inside the PaymentBlock on the
  // Attendance tab. The block is mutually exclusive (Pay now hides
  // Pay later and vice versa) and Save is NOT gated by the choice —
  // Pay later is a de-emphasized alternative, not a blocker.
  const searchParams = useSearchParams();
  // Household name is editable from the RSVP form.
  const [householdName, setHouseholdName] = useState('');
  // Tracks whether the user has begun editing. We only seed from
  // the server snapshot when the form is empty, so a refetch that
  // races with the confirm mutation cannot overwrite in-progress
  // edits.
  const [hydrated, setHydrated] = useState(false);
  // FPP-123: local payment choice (sticky Pay later, inline Pay
  // now form, or back-to-buttons). The Paid state is derived from
  // `registration?.status === 'PAID'` so we do not have to mirror
  // server truth into local state — that keeps the form in sync
  // when the user reopens the sheet after paying on a previous
  // visit, and avoids the cascading-render trap a `useEffect ->
  // setState` sync would introduce.
  const [paymentChoice, setPaymentChoice] = useState<'payLater' | 'payNow' | null>(null);
  // FPP-123: pull the caller's existing registration so we can
  // collapse the payment block into a "Paid" badge instead of
  // re-prompting. Only fetch when the sheet is open and a fee
  // applies — otherwise we are not going to render the block at
  // all and the request is wasted bandwidth.
  const registrationQuery = trpc.payment.getMyRegistration.useQuery(
    { eventId },
    {
      enabled:
        isOpen && registrationFeeConfig != null && (registrationFeeConfig?.amountCents ?? 0) > 0,
    },
  );
  const registration = registrationQuery.data ?? null;

  useEffect(() => {
    if (!isOpen) {
      // Reset everything on close so a fresh open does not inherit
      // a stale snapshot from a previous event.
      /* eslint-disable react-hooks/set-state-in-effect */
      setDrafts([]);
      setNewMember({ name: '', age: '', saveToHousehold: true });
      setShowAddMember(false);
      phoneField.reset('');
      setSmsConsent(false);
      setSubmitError(null);
      setEditingAgeIndex(null);
      setEditingAgeValue('');
      ageEditCancelledRef.current = false;
      setHouseholdName('');
      setHydrated(false);
      setActiveTab('attendance');
      setShowSuccess(false);
      setConfirmedInSession(false);
      setPaymentChoice(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  // FPP-21: honor the ?rsvpOpen=1#potluck deep link from the
  // per-event potluck page.
  useEffect(() => {
    if (!isOpen) return;
    const rsvpOpen = searchParams?.get('rsvpOpen') === '1';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (rsvpOpen && (hash === '#potluck' || hash === '#dishes')) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setActiveTab('potluck');
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [isOpen]);

  // Seed drafts from the server snapshot only on the first load.
  useEffect(() => {
    if (!isOpen || hydrated) return;
    if (!formState) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDrafts(
      buildInitialDrafts(
        formState.members,
        formState.rsvp?.memberAttendances ?? [],
        formState.userName,
      ),
    );
    // FPP-120: never auto-fill the household name with a derived
    // default. If the user already has a household name, show it;
    // otherwise leave the field empty so they consciously type
    // their own. The required-name validation on save will catch
    // any blank value.
    setHouseholdName(formState.householdName ?? '');
    // Seed the phone field from the server snapshot. The hook
    // re-formats the E.164 (`+15551234567`) into the canonical
    // `+1 (555) 123-4567` display on mount.
    phoneField.reset(formState.phoneNumber ?? '');
    setSmsConsent(Boolean(formState.smsConsent));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, hydrated, formState]);

  const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;
  const canEditPotluck = confirmedInSession || formState?.rsvp?.status === 'CONFIRMED';
  const yesCount = useMemo(
    () => drafts.filter((d) => d.attending === RsvpAttending.YES).length,
    [drafts],
  );

  // FPP-36: live-validate every slot name so an empty / oversized /
  // control-character-laden name blocks confirm. The first failing
  // row is surfaced inline so the user can correct it without a
  // round-trip to the server.
  const nameErrors = useMemo(() => {
    const errors: Array<{ index: number; message: string }> = [];
    drafts.forEach((draft, index) => {
      const parsed = attendeeNameSchema.safeParse(draft.memberName);
      if (!parsed.success) {
        errors.push({
          index,
          message: parsed.error.issues[0]?.message ?? 'Name is required',
        });
      }
    });
    return errors;
  }, [drafts]);
  const firstNameError = nameErrors[0] ?? null;
  const hasInvalidNames = nameErrors.length > 0;

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
  // FPP-123: Save is gated on the payment choice when a fee
  // applies. `'payLater'` covers the explicit deferral; `'paid'`
  // is derived from the server snapshot so a user who paid on a
  // previous visit (or completed the inline form moments ago) does
  // not have to re-pick. While the inline form is mounting
  // (`'payNow'`) we leave Save disabled so the user does not race
  // the network with their submission.
  const isPaid = registration?.status === 'PAID';
  const paymentChosen = isPaid || paymentChoice === 'payLater';
  const saveRequiresPayment = showFeeLine && !paymentChosen;

  const updateAttendance = (index: number, value: RsvpAttending) => {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, attending: value } : d)));
  };

  const updateMemberNameDraft = (index: number, value: string) => {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, memberName: value } : d)));
  };

  // FPP-36 review finding 4: strip trailing whitespace when the
  // user leaves the input. Live-trimming on every keystroke would
  // jump the caret mid-edit; trimming on blur keeps the cursor
  // honest while editing and the visible value honest on commit.
  // We only strip the trailing edge so a user can still type a
  // leading capital without it collapsing on every character.
  const trimMemberNameDraft = (index: number) => {
    setDrafts((current) =>
      current.map((d, i) => {
        if (i !== index) return d;
        const trimmed = d.memberName.replace(/\s+$/, '');
        return trimmed === d.memberName ? d : { ...d, memberName: trimmed };
      }),
    );
  };

  const removeMember = (index: number) => {
    setDrafts((current) => current.filter((_, i) => i !== index));
  };

  const addAdHocMember = () => {
    const name = newMember.name.trim();
    if (!name) return;
    const nameParsed = attendeeNameSchema.safeParse(newMember.name);
    if (!nameParsed.success) {
      setSubmitError(nameParsed.error.issues[0]?.message ?? 'Name is required');
      return;
    }
    const ageTrimmed = newMember.age.trim();
    let ageValue: number | null = null;
    if (ageTrimmed !== '') {
      const num = Number(ageTrimmed);
      if (Number.isNaN(num) || num < 0 || num > 120) {
        setSubmitError('Age must be between 0 and 120.');
        return;
      }
      ageValue = num;
    }

    setSubmitError(null);
    setDrafts((current) => [
      ...current,
      {
        draftKey: nextDraftKey(),
        householdMemberId: null,
        memberName: nameParsed.data,
        memberAge: ageValue,
        attending: RsvpAttending.YES,
        originalMemberName: null,
        originalMemberAge: null,
        saveToHousehold: newMember.saveToHousehold,
      },
    ]);
    setNewMember({ name: '', age: '', saveToHousehold: true });
    setShowAddMember(false);
  };

  // FPP-34: validate the optional phone + consent block before any
  // RSVP mutation. When validation passes, compute the diff and
  // PATCH when something changed. Returns false when the caller
  // should bail (the submit error has already been set).
  //
  // The helper is a closure so the contact rules, the form-state
  // snapshot, and the in-flight setState callbacks stay in one
  // place. Both `handleConfirm` and `handleDecline` go through it
  // so a tweak to the consent-required rule lands in both at once.
  const persistContactIfChanged = async (): Promise<boolean> => {
    if (!formState) return true;
    const contactParsed = rsvpContactSchema.safeParse({ phone, smsConsent });
    if (!contactParsed.success) {
      const firstIssue = contactParsed.error.issues[0]?.message ?? 'Phone or consent is invalid';
      setSubmitError(firstIssue);
      setIsSubmitting(false);
      return false;
    }
    const contactPatch = diffContact(
      { phone, smsConsent },
      {
        phoneNumber: formState.phoneNumber ?? null,
        smsConsent: Boolean(formState.smsConsent),
      },
    );
    if (Object.keys(contactPatch).length > 0) {
      await updatePreferences.mutateAsync(contactPatch);
    }
    return true;
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    const renames: Array<{ from: string; to: string }> = [];
    const renameSummary = () => {
      if (renames.length === 0) return '';
      const list = renames.map((r) => `${r.from} → ${r.to}`).join(', ');
      return `Renamed ${renames.length} member${renames.length === 1 ? '' : 's'} (${list}) before the error. `;
    };
    if (!formState) {
      setIsSubmitting(false);
      return;
    }
    if (drafts.length === 0) {
      setSubmitError('Add at least one person before confirming.');
      setIsSubmitting(false);
      return;
    }
    if (hasInvalidNames) {
      setSubmitError(firstNameError?.message ?? 'Each attendee needs a valid name.');
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
      if (!(await persistContactIfChanged())) {
        return;
      }

      // The router populates `householdId` with `caller.householdId ?? caller.id`
      // so the value is always truthy — the `!effectiveHouseholdId` check that
      // used to live here was dead code. Use the explicit `hasHousehold` flag
      // to decide between create and rename, and the real `householdId` as
      // the rename target.
      let effectiveHouseholdId: string;
      const trimmedHName = householdName.trim();

      const parsedHName = householdNameSchema.safeParse(trimmedHName);
      if (!parsedHName.success) {
        setSubmitError(parsedHName.error.issues[0]?.message ?? 'Household name is required');
        setIsSubmitting(false);
        return;
      }

      if (!formState.hasHousehold) {
        // FPP-117: caller has no household yet — create one and seed a
        // self-member via the onboarding endpoint, then rename the new
        // household by writing through to the same mutation used by the
        // profile page.
        const createHRes = await fetch('/api/onboarding/household', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: parsedHName.data }),
        });
        if (!createHRes.ok) {
          const errData = (await createHRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || 'Could not create household');
        }
        const createHData = (await createHRes.json()) as { householdId: string };
        effectiveHouseholdId = createHData.householdId;
      } else {
        // FPP-117: when the household already exists, the rename gate must
        // trigger on any change — including the snapshot being null (e.g.
        // a household with no name yet). The previous guard
        // `formState.householdName !== null` silently dropped that case.
        effectiveHouseholdId = formState.householdId;
        if (parsedHName.data !== formState.householdName) {
          await updateName.mutateAsync({
            id: effectiveHouseholdId,
            name: parsedHName.data,
          });
        }
      }

      // Save any new members to household if saveToHousehold is selected
      const finalDrafts = [...drafts];
      for (let i = 0; i < finalDrafts.length; i++) {
        const draft = finalDrafts[i]!;
        if (!draft.householdMemberId && draft.saveToHousehold && effectiveHouseholdId) {
          // FPP-121: surface a POST failure instead of silently dropping the
          // member from the household roster. A 400 here usually means the
          // member has no age — schema requires it — so the user should see
          // the error and add one rather than confirm with a half-saved
          // roster.
          if (draft.memberAge == null) {
            throw new Error(
              `Set an age for "${draft.memberName.trim()}" before saving them to your household.`,
            );
          }
          const addMemRes = await fetch('/api/household-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId: effectiveHouseholdId,
              name: draft.memberName.trim(),
              age: draft.memberAge,
            }),
          });
          if (!addMemRes.ok) {
            const errData = (await addMemRes.json().catch(() => ({}))) as { error?: string };
            throw new Error(
              errData.error || `Could not save "${draft.memberName.trim()}" to your household`,
            );
          }
          const memberData = (await addMemRes.json()) as { id: string };
          finalDrafts[i] = {
            ...draft,
            householdMemberId: memberData.id,
            originalMemberName: draft.memberName.trim(),
          };
        } else if (draft.householdMemberId) {
          const nameChanged = draft.memberName !== draft.originalMemberName;
          const ageChanged = draft.memberAge !== draft.originalMemberAge;
          if (!nameChanged && !ageChanged) continue;
          const patchBody: { name?: string; age?: number | null } = {};
          if (nameChanged) patchBody.name = draft.memberName;
          if (ageChanged) patchBody.age = draft.memberAge;
          await updateMemberName.mutateAsync({
            id: draft.householdMemberId,
            ...patchBody,
          });
          if (nameChanged) {
            renames.push({
              from: draft.originalMemberName ?? draft.memberName,
              to: draft.memberName,
            });
          }
        }
      }

      const trimmedDrafts = finalDrafts.map((d) => ({
        ...d,
        memberName: attendeeNameSchema.parse(d.memberName),
      }));
      const result = await confirm.mutateAsync({
        eventId,
        memberAttendances: trimmedDrafts.map((d) => ({
          householdMemberId: d.householdMemberId,
          memberName: d.memberName,
          memberAge: d.memberAge,
          attending: d.attending,
        })),
      });
      if (onConfirmed) {
        onConfirmed(result.id);
      }
      setShowSuccess(true);
      if (!result.isWaitlisted) {
        setConfirmedInSession(true);
        setActiveTab('potluck');
      }
    } catch (err) {
      const base = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      const summary = renameSummary();
      setSubmitError(summary ? `${summary}${base}` : base);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // FPP-34: persist any phone + consent changes before the
      // decline, so a user who opts in to SMS on the form and then
      // declines the event still gets their profile updated. The
      // RSVP goes from "no response" to "declined" either way; the
      // contact preference is independent. Shared helper keeps the
      // confirm and decline paths in lockstep.
      if (!(await persistContactIfChanged())) {
        return;
      }
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

  if (!isOpen) return null;

  // Show a retryable error state when the roster fetch fails.
  if (fetchError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" variant="bottom-sheet">
        <div className="py-8 text-center">
          <div className="bg-destructive/10 mx-auto flex h-20 w-20 items-center justify-center rounded-sm">
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
            className="bg-terracotta shadow-soft press hover:bg-terracotta/90 mt-6 rounded-sm px-5 py-2.5 text-sm font-semibold text-white transition-all"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground mt-2 block w-full rounded-sm px-5 py-2.5 text-sm font-medium"
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
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" variant="bottom-sheet">
        <div className="py-8 text-center" aria-busy="true">
          <div className="bg-secondary mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-sm" />
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
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" variant="bottom-sheet">
      {/*
        FPP-21: two-tab editor. The Attendance tab collects the
        household roster; the Potluck tab embeds PotluckEditor so
        the user can claim a slot without leaving the sheet. The
        Potluck tab is enabled only after the RSVP is confirmed.

        FPP-115: the tab bar is sticky at the top of the scroll
        container so a household with many members can always flip
        back to edit attendance without scrolling to the top. The
        sheet body itself is viewport-constrained and scrolls.
      */}
      <div
        className="border-border bg-secondary/80 sticky top-0 z-10 mx-auto mb-5 flex w-full max-w-md rounded-sm border p-1 shadow-sm backdrop-blur-sm"
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
              ? 'bg-primary text-primary-foreground flex-1 rounded-sm px-4 py-2 text-sm font-semibold shadow-sm transition-all'
              : 'text-muted-foreground hover:text-foreground flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-all'
          }
        >
          Attendance
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'potluck'}
          data-testid="rsvp-tab-potluck"
          onClick={() => setActiveTab('potluck')}
          className={
            activeTab === 'potluck'
              ? 'bg-primary text-primary-foreground flex-1 rounded-sm px-4 py-2 text-sm font-semibold shadow-sm transition-all'
              : 'text-muted-foreground hover:text-foreground flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-all'
          }
        >
          Potluck
        </button>
      </div>

      {showSuccess && (
        <div
          className="bg-sage/15 ring-sage/30 mb-5 flex items-center gap-3 rounded-sm px-4 py-3 text-sm ring-1"
          data-testid="rsvp-success-banner"
          role="status"
        >
          <span className="bg-sage/30 text-sage flex h-7 w-7 items-center justify-center rounded-sm font-bold">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground font-semibold">You&apos;re on the list!</p>
            <p className="text-muted-foreground text-xs">
              Your RSVP is saved. Choose what you&apos;ll bring next.
            </p>
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

          <div className="mt-8" data-testid="rsvp-household-name-field">
            <label
              htmlFor="rsvp-household-name"
              className="text-foreground block text-sm font-medium"
            >
              Household name
            </label>
            <p className="text-muted-foreground mt-1 text-xs">
              Name for your family or group on the roster and confirmations.
            </p>
            <input
              id="rsvp-household-name"
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              maxLength={HOUSEHOLD_NAME_MAX}
              autoComplete="off"
              // FPP-120: the placeholder no longer pre-fills a
              // real surname so the user is prompted to choose
              // their own household name.
              placeholder="e.g. The Garcia Family Picnic Crew"
              className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground mt-3 block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            />
          </div>

          {drafts.length === 0 ? (
            <div className="bg-sunlight/20 mt-8 rounded-sm p-6 text-center">
              <p className="text-foreground text-base">
                Your household has no members listed yet. Add one below to RSVP.
              </p>
            </div>
          ) : (
            <ul className="mt-8 grid gap-2 sm:grid-cols-2">
              {drafts.map((draft, index) => {
                const rowError = nameErrors.find((e) => e.index === index)?.message;
                // FPP-36: source the accessible name from the
                // snapshot when one exists, and from the schema-
                // validated live value otherwise. The snapshot
                // passed through `attendeeNameSchema` on hydrate
                // so it can never contain control characters.
                // Ad-hoc guests (no `originalMemberName`) fall
                // back to the trimmed live value, but only when
                // that value also passes `attendeeNameSchema` —
                // the trim alone does not strip line separators
                // or other forbidden characters, so a guest
                // mid-typing a control character would otherwise
                // surface it to a screen reader before the form
                // blocks submit. The final `slot N` fallback
                // covers the empty-string and invalid-input cases
                // before the user has typed anything sensible.
                // Note the use of `||` (not `??`) for the
                // secondary tier so an empty trimmed name falls
                // through to the slot label rather than leaving
                // the screen reader to announce "Name for" with
                // an empty suffix.
                const trimmedLiveName = draft.memberName.trim();
                const safeLiveName = attendeeNameSchema.safeParse(trimmedLiveName).success
                  ? trimmedLiveName
                  : null;
                const accessibleName =
                  draft.originalMemberName ?? safeLiveName ?? `slot ${index + 1}`;
                return (
                  <li
                    key={draft.draftKey}
                    className="border-border bg-card/40 flex flex-col gap-2 rounded-sm border px-4 py-3"
                  >
                    <div>
                      <input
                        type="text"
                        aria-label={`Name for ${accessibleName}`}
                        value={draft.memberName}
                        onChange={(e) => updateMemberNameDraft(index, e.target.value)}
                        onBlur={() => trimMemberNameDraft(index)}
                        maxLength={ATTENDEE_NAME_MAX}
                        autoComplete="off"
                        placeholder="Name"
                        data-testid="rsvp-attendee-name"
                        className={`border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground block w-full rounded-sm border px-3 py-2 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none ${
                          rowError ? 'border-destructive focus:border-destructive' : ''
                        }`}
                      />
                      {rowError && (
                        <p
                          className="text-destructive mt-1 text-xs"
                          data-testid="rsvp-attendee-name-error"
                        >
                          {rowError}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        {editingAgeIndex === index ? (
                          <div className="flex items-center gap-1 text-xs">
                            <input
                              type="number"
                              min="0"
                              max="120"
                              value={editingAgeValue}
                              onChange={(e) => setEditingAgeValue(e.target.value)}
                              onBlur={() => {
                                if (ageEditCancelledRef.current) {
                                  ageEditCancelledRef.current = false;
                                  setEditingAgeIndex(null);
                                  setEditingAgeValue('');
                                  return;
                                }
                                const trimmed = editingAgeValue.trim();
                                if (trimmed === '') {
                                  setDrafts((current) =>
                                    current.map((d, i) =>
                                      i === index ? { ...d, memberAge: null } : d,
                                    ),
                                  );
                                } else {
                                  const num = Number(trimmed);
                                  if (!Number.isNaN(num) && num >= 0 && num <= 120) {
                                    setDrafts((current) =>
                                      current.map((d, i) =>
                                        i === index ? { ...d, memberAge: num } : d,
                                      ),
                                    );
                                  }
                                }
                                setEditingAgeIndex(null);
                                setEditingAgeValue('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === 'Escape') {
                                  ageEditCancelledRef.current = true;
                                  setEditingAgeIndex(null);
                                  setEditingAgeValue('');
                                }
                              }}
                              autoFocus
                              className="border-border bg-card text-foreground w-20 rounded-sm border px-2 py-1 focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                              aria-label="Edit age"
                            />
                          </div>
                        ) : draft.memberAge !== null ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAgeValue(String(draft.memberAge));
                              setEditingAgeIndex(index);
                            }}
                            className="text-muted-foreground hover:text-foreground text-xs"
                            aria-label="Edit age"
                          >
                            {draft.memberAge} yrs
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAgeValue('');
                              setEditingAgeIndex(index);
                            }}
                            className="text-muted-foreground hover:text-foreground text-xs italic"
                            aria-label="Set age"
                          >
                            Set age
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <select
                          aria-label={`Attendance for ${accessibleName}`}
                          value={draft.attending}
                          onChange={(e) => updateAttendance(index, e.target.value as RsvpAttending)}
                          className="border-border bg-card text-foreground focus:border-foreground min-h-10 rounded-sm border px-3 py-2 text-sm focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
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
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {showAddMember ? (
            <div className="bg-secondary/40 mt-4 rounded-sm p-4">
              <h4 className="text-foreground text-sm font-semibold">
                {newMember.saveToHousehold ? 'Add household member' : 'Add one-time guest'}
              </h4>
              <p className="text-muted-foreground mt-1 text-xs">
                {newMember.saveToHousehold
                  ? 'Saved to your permanent household roster for this and future events.'
                  : 'Saved on this RSVP only without adding to your permanent household roster.'}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Full name"
                  aria-label={newMember.saveToHousehold ? 'Member name' : 'Guest name'}
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground rounded-sm border px-3 py-2 text-sm focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={newMember.age}
                  onChange={(e) => setNewMember({ ...newMember, age: e.target.value })}
                  placeholder="Age"
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground rounded-sm border px-3 py-2 text-sm focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                />
              </div>
              <label className="text-foreground mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newMember.saveToHousehold}
                  onChange={(e) =>
                    setNewMember({ ...newMember, saveToHousehold: e.target.checked })
                  }
                  className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4 rounded"
                />
                <span>Save to my household for future events</span>
              </label>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={addAdHocMember}
                  disabled={!newMember.name.trim()}
                  className="bg-terracotta press hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50"
                  data-testid="rsvp-add-person-submit"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMember({ name: '', age: '', saveToHousehold: true });
                    setSubmitError(null);
                  }}
                  className="text-muted-foreground hover:text-foreground rounded-sm px-3 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setNewMember({ name: '', age: '', saveToHousehold: true });
                  setShowAddMember(true);
                }}
                className="bg-terracotta/15 text-terracotta hover:bg-terracotta/25 press rounded-sm px-4 py-2 text-sm font-semibold transition-all"
                data-testid="rsvp-add-member-button"
              >
                + Add household member
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewMember({ name: '', age: '', saveToHousehold: false });
                  setShowAddMember(true);
                }}
                className="text-muted-foreground hover:text-foreground text-xs font-medium underline underline-offset-4"
              >
                + Add a one-time guest
              </button>
            </div>
          )}

          <p className="text-muted-foreground mt-5 text-xs">
            {yesCount === 1 ? '1 person' : `${yesCount} people`} going
          </p>

          {showFeeLine && (
            <div data-testid="rsvp-fee-line" className="mt-3">
              <PaymentBlock
                eventId={eventId}
                eventName={eventName ?? 'this event'}
                amountCents={feeBreakdown.amountCents}
                currency={feeCurrency}
                breakdown={{
                  qualifyingAttendees: feeBreakdown.qualifyingAttendees,
                  perAttendeeCents: registrationFeeConfig?.amountCents ?? 0,
                }}
                registration={registration}
                choice={paymentChoice}
                onChoiceChange={setPaymentChoice}
              />
            </div>
          )}

          <div className="mt-3" data-testid="rsvp-contact-section">
            <div className="bg-secondary/40 mt-1 rounded-sm p-4">
              <label htmlFor="rsvp-phone" className="text-foreground block text-sm font-medium">
                Mobile phone
              </label>
              <p className="text-muted-foreground mt-1 text-xs">
                We&apos;ll text event updates only with your consent. Standard rates may apply.
              </p>
              <input
                id="rsvp-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneField.display}
                onChange={phoneField.onChange}
                placeholder="+1 (555) 123-4567"
                data-testid="rsvp-phone-input"
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground mt-3 block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
              />
              <label className="text-foreground mt-4 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  data-testid="rsvp-sms-consent"
                  className="border-border text-terracotta focus:ring-foreground/20 mt-0.5 h-4 w-4 rounded"
                />
                <span>
                  I agree to receive SMS updates about events from this organizer. I can opt out at
                  any time by clearing the phone number above.
                </span>
              </label>
              {phone.trim().length > 0 && !smsConsent && (
                <p className="text-destructive mt-2 text-xs" data-testid="rsvp-sms-consent-error">
                  Check the consent box above to save this phone number.
                </p>
              )}
            </div>
          </div>

          {submitError && (
            <p className="bg-destructive/10 text-destructive ring-destructive/30 mt-4 rounded-sm px-4 py-3 text-sm ring-1">
              {submitError}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={isSubmitting || yesCount === 0 || hasInvalidNames || saveRequiresPayment}
            className="bg-terracotta shadow-soft press hover:bg-terracotta/90 mt-7 w-full rounded-sm px-6 py-3.5 font-semibold text-white transition-all disabled:opacity-50"
            data-testid="rsvp-save-button"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>

          <button
            onClick={handleDecline}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-destructive mt-3 w-full rounded-sm px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Can&apos;t make it
          </button>
        </>
      ) : (
        <div data-testid="rsvp-potluck-tab">
          {canEditPotluck ? (
            <>
              <PotluckEditor eventId={eventId} hasRsvp isRsvpConfirmed />
              {showFeeLine && (
                <div className="mt-3" data-testid="rsvp-fee-line">
                  <PaymentBlock
                    eventId={eventId}
                    eventName={eventName ?? 'this event'}
                    amountCents={feeBreakdown.amountCents}
                    currency={feeCurrency}
                    breakdown={{
                      qualifyingAttendees: feeBreakdown.qualifyingAttendees,
                      perAttendeeCents: registrationFeeConfig?.amountCents ?? 0,
                    }}
                    registration={registration}
                    choice={paymentChoice}
                    onChoiceChange={setPaymentChoice}
                    hint={`You can pay ${formatAmount(
                      feeBreakdown.amountCents,
                      feeCurrency,
                    )} for ${eventName ?? 'this event'} any time before the event.`}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="bg-terracotta shadow-soft press hover:bg-terracotta/90 mt-7 w-full rounded-sm px-6 py-3.5 font-semibold text-white transition-all"
                data-testid="rsvp-potluck-done"
              >
                Done
              </button>
            </>
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
                className="bg-terracotta press hover:bg-terracotta/90 mt-5 rounded-sm px-5 py-2.5 text-sm font-semibold text-white transition-all"
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
