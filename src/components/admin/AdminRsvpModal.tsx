'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '~/lib/trpc-client';
import { useToast } from '~/components/ui/Toast';
import Modal from '~/components/ui/Modal';
import { RSVPStatus, RsvpAttending, type EventStatus } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';

const ATTENDING_OPTIONS: RsvpAttending[] = [
  RsvpAttending.YES,
  RsvpAttending.NO,
  RsvpAttending.MAYBE,
];

const STATUS_VALUES: RSVPStatus[] = [RSVPStatus.CONFIRMED, RSVPStatus.DECLINED];

interface AdminRsvpModalRsvp {
  id: string;
  eventId: string;
  userId: string;
  householdId: string;
  status: RSVPStatus;
  headcount: number;
  declineMessage: string | null;
  memberAttendances: Array<{
    id: string;
    householdMemberId: string | null;
    memberNameSnapshot: string;
    memberAgeSnapshot: number | null;
    attending: RsvpAttending;
  }>;
}

export interface AdminRsvpModalMember {
  id: string;
  name: string;
  age: number | null;
  relationship: string | null;
}

interface AdminRsvpModalProps {
  eventId: string;
  eventName: string;
  eventStatus: EventStatus;
  /** When set, the modal opens in "edit" mode and fetches the RSVP via tRPC. */
  rsvpId?: string;
  /**
   * Required for the "add" path: the user we are creating a new
   * RSVP for. Also used in the "edit" path for the modal title.
   */
  targetUser: { id: string; name: string; email: string; householdName: string | null };
  /**
   * The household roster. Optional in the "edit" path because the
   * tRPC fetch returns the same data; required in the "add" path
   * because the modal has no other source for the per-member
   * attendance grid. The parent component is responsible for
   * passing it in the "add" path.
   */
  members?: AdminRsvpModalMember[];
  onClose: () => void;
  onSaved?: () => void;
}

interface AttendanceFormRow {
  householdMemberId: string;
  memberName: string;
  memberAge: number | null;
  relationship: string | null;
  attending: RsvpAttending;
}

function safeCount(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function AdminRsvpModal({
  eventId,
  eventName,
  eventStatus,
  rsvpId,
  targetUser,
  members: membersProp,
  onClose,
  onSaved,
}: AdminRsvpModalProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(rsvpId);
  const isReadOnly = eventStatus === 'CANCELLED';

  const [status, setStatus] = useState<RSVPStatus>(RSVPStatus.CONFIRMED);
  const [headcount, setHeadcount] = useState<number>(1);
  const [declineMessage, setDeclineMessage] = useState('');
  const [attendanceRows, setAttendanceRows] = useState<AttendanceFormRow[]>([]);
  const [members, setMembers] = useState<AdminRsvpModalMember[]>(membersProp ?? []);
  const [rsvp, setRsvp] = useState<AdminRsvpModalRsvp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);

  const rsvpQuery = trpc.rsvp.getById.useQuery(
    { rsvpId: rsvpId ?? '' },
    { enabled: Boolean(rsvpId) },
  );

  useEffect(() => {
    if (!isEdit) {
      // Add mode: start with a clean form. Members come from props
      // (the page passes the household roster down) so the admin
      // can pre-fill attendance immediately. The setState calls
      // here are intentional — the modal's `key` resets whenever
      // the parent opens a new instance, so this only runs on
      // mount, not on every render.
      /* eslint-disable react-hooks/set-state-in-effect */
      setStatus(RSVPStatus.CONFIRMED);
      setHeadcount(1);
      setDeclineMessage('');
      const roster = (membersProp ?? []).map((m) => ({
        householdMemberId: m.id,
        memberName: m.name,
        memberAge: m.age,
        relationship: m.relationship,
        attending: RsvpAttending.YES,
      }));
      setAttendanceRows(roster);
      setMembers(membersProp ?? []);
      setHydrated(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    // Edit mode: the tRPC query resolves async. The setState
    // calls below populate the form once the data lands. A
    // `key` on the modal (in the parent) remounts the
    // component when the user opens a different RSVP, so these
    // calls are bounded to one render per source.
    const data = rsvpQuery.data;
    if (!data) return;

    setRsvp(data.rsvp);
    setMembers(data.members);
    setStatus(
      data.rsvp.status === RSVPStatus.DECLINED ? RSVPStatus.DECLINED : RSVPStatus.CONFIRMED,
    );
    setHeadcount(data.rsvp.headcount);
    setDeclineMessage(data.rsvp.declineMessage ?? '');
    // Build the form rows from members (source of truth) and
    // overlay any existing attendance entries so the admin sees
    // the prior decision next to the member.
    const byMemberId = new Map(
      data.rsvp.memberAttendances
        .filter((a) => a.householdMemberId !== null)
        .map((a) => [a.householdMemberId as string, a]),
    );
    const rows: AttendanceFormRow[] = data.members.map((m) => {
      const existing = byMemberId.get(m.id);
      return {
        householdMemberId: m.id,
        memberName: m.name,
        memberAge: m.age,
        relationship: m.relationship,
        attending: existing?.attending ?? RsvpAttending.YES,
      };
    });
    setAttendanceRows(rows);
    setHydrated(true);
  }, [isEdit, rsvpQuery.data, membersProp]);

  // Auto-derive headcount from YES rows when attendance rows are
  // visible. The admin can override with the number input, but
  // the field stays in sync with the per-member grid on every
  // change so the two never disagree.
  const yesCount = useMemo(
    () => attendanceRows.filter((r) => r.attending === RsvpAttending.YES).length,
    [attendanceRows],
  );

  useEffect(() => {
    if (members.length === 0) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setHeadcount(yesCount);
    /* eslint-enable react-hooks/set-state-in-effect */
    // We deliberately depend only on `yesCount` so toggling rows
    // re-syncs the input without an infinite loop (we never
    // re-derive from headcount, only the other direction).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yesCount]);

  function updateRowAttending(householdMemberId: string, attending: RsvpAttending) {
    setAttendanceRows((prev) =>
      prev.map((r) => (r.householdMemberId === householdMemberId ? { ...r, attending } : r)),
    );
  }

  const [submitting, setSubmitting] = useState(false);

  function buildPayload() {
    // `memberAttendances` is the wire shape — only the four
    // fields the server's `rsvpMemberAttendanceInputSchema`
    // accepts. The form row carries extra UI-only data
    // (relationship) that the server already has on the
    // household member record.
    type AttendancePayload = {
      householdMemberId: string;
      memberName: string;
      memberAge: number | null;
      attending: RsvpAttending;
    };
    const payload: {
      eventId: string;
      userId: string;
      status: RSVPStatus;
      headcount: number;
      memberAttendances?: AttendancePayload[];
      declineMessage?: string;
    } = {
      eventId,
      userId: targetUser.id,
      status,
      headcount,
    };
    // Only ship the per-member attendance grid when the admin
    // is recording a CONFIRMED RSVP. The decline path hides the
    // grid entirely so the admin cannot tweak individual
    // members; the server flips any existing rows to NO inside
    // the transaction (see the adminOverride implementation).
    if (status === RSVPStatus.CONFIRMED && attendanceRows.length > 0) {
      payload.memberAttendances = attendanceRows.map((r): AttendancePayload => ({
        householdMemberId: r.householdMemberId,
        memberName: r.memberName,
        memberAge: r.memberAge,
        attending: r.attending,
      }));
    }
    if (status === RSVPStatus.DECLINED && declineMessage.length > 0) {
      // The schema trims the value before we receive it, so no
      // additional trim is required here. An empty string stays
      // as `""` and the server treats it as no note.
      payload.declineMessage = declineMessage;
    }
    return payload;
  }

  async function handleSave() {
    setError(null);
    if (status === RSVPStatus.CONFIRMED) {
      const derivedHeadcount = attendanceRows.length > 0 ? yesCount : headcount;
      if (derivedHeadcount < 1) {
        setError('At least one member must be marked as going for a confirmed RSVP.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/rsvp/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
          const body = JSON.parse(text) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // Plain-text response — keep as the raw body.
        }
        setError(message || 'Could not save RSVP');
        return;
      }
      toast.addToast(
        'success',
        status === RSVPStatus.DECLINED ? 'RSVP declined' : 'RSVP confirmed',
      );
      onSaved?.();
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save RSVP');
    } finally {
      setSubmitting(false);
    }
  }

  const titlePrefix = isEdit ? 'Edit RSVP' : 'Add RSVP';
  const householdLabel = targetUser.householdName ?? targetUser.name;

  if (!hydrated && isEdit) {
    return (
      <Modal isOpen onClose={onClose} title={`${titlePrefix} · ${eventName}`} size="lg">
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">Loading RSVP…</p>
          {rsvpQuery.error ? (
            <p className="text-destructive text-sm">{rsvpQuery.error.message}</p>
          ) : null}
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={`${titlePrefix} · ${eventName}`} size="lg">
      <div className="space-y-5" data-testid="admin-rsvp-modal">
        <div className="bg-secondary rounded-xl p-3">
          <p className="text-foreground text-sm font-semibold">{householdLabel}</p>
          <p className="text-muted-foreground text-xs">
            {targetUser.name} · {targetUser.email}
          </p>
          {rsvp ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Existing RSVP · {rsvp.status} · {rsvp.memberAttendances.length} member
              {rsvp.memberAttendances.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>

        {isReadOnly ? (
          <div
            className="bg-sunlight/20 text-foreground rounded-xl p-3 text-sm"
            data-testid="admin-rsvp-readonly"
          >
            This event is cancelled. RSVPs are read-only.
          </div>
        ) : null}

        <fieldset disabled={isReadOnly} className="space-y-2">
          <legend className="text-foreground text-sm font-medium">Status</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="RSVP status">
            {STATUS_VALUES.map((value) => {
              const selected = status === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setStatus(value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? value === RSVPStatus.DECLINED
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-sage bg-sage/10 text-sage'
                      : 'border-border text-foreground/85 hover:bg-secondary bg-card'
                  } ${isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                  data-testid={`status-${value.toLowerCase()}`}
                >
                  {value === RSVPStatus.CONFIRMED ? 'Confirmed' : 'Declined'}
                </button>
              );
            })}
          </div>
        </fieldset>

        {status === RSVPStatus.CONFIRMED ? (
          <div>
            <label
              htmlFor="admin-rsvp-headcount"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Headcount
            </label>
            <input
              id="admin-rsvp-headcount"
              type="number"
              min="0"
              value={headcount}
              onChange={(e) => setHeadcount(safeCount(e.target.value))}
              className="border-border focus:border-foreground bg-card block w-full rounded-2xl border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
              data-testid="headcount-input"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {members.length > 0
                ? `Auto-calculated from ${yesCount} “Going” member${yesCount === 1 ? '' : 's'}.`
                : 'Override the default headcount.'}
            </p>
          </div>
        ) : null}

        {status === RSVPStatus.DECLINED ? (
          <div>
            <label
              htmlFor="admin-rsvp-decline-message"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Decline message (optional)
            </label>
            <textarea
              id="admin-rsvp-decline-message"
              value={declineMessage}
              onChange={(e) => setDeclineMessage(e.target.value)}
              maxLength={1000}
              rows={3}
              className="border-border focus:border-foreground bg-card block w-full rounded-2xl border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
              placeholder="Forwarded to the event owner"
              data-testid="decline-message"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {declineMessage.length} / 1000 characters
            </p>
          </div>
        ) : null}

        {members.length > 0 && status === RSVPStatus.CONFIRMED ? (
          <div>
            <p className="text-foreground mb-2 text-sm font-medium">Per-member attendance</p>
            <div
              className="border-border bg-card overflow-hidden rounded-xl border"
              data-testid="attendance-grid"
            >
              <table className="divide-border min-w-full divide-y">
                <thead className="bg-secondary/60">
                  <tr>
                    <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium tracking-wider uppercase">
                      Member
                    </th>
                    {ATTENDING_OPTIONS.map((opt) => (
                      <th
                        key={opt}
                        className="text-muted-foreground px-3 py-2 text-center text-xs font-medium tracking-wider uppercase"
                      >
                        {attendingLabel(opt)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {attendanceRows.map((row) => (
                    <tr key={row.householdMemberId} data-testid={`row-${row.householdMemberId}`}>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-foreground font-medium">{row.memberName}</div>
                        {row.relationship ? (
                          <div className="text-muted-foreground text-xs">
                            {row.relationship}
                            {row.memberAge !== null ? ` · Age ${row.memberAge}` : ''}
                          </div>
                        ) : row.memberAge !== null ? (
                          <div className="text-muted-foreground text-xs">Age {row.memberAge}</div>
                        ) : null}
                      </td>
                      {ATTENDING_OPTIONS.map((opt) => (
                        <td key={opt} className="px-3 py-2 text-center">
                          <label className="inline-flex cursor-pointer items-center">
                            <input
                              type="radio"
                              name={`attending-${row.householdMemberId}`}
                              value={opt}
                              checked={row.attending === opt}
                              onChange={() => updateRowAttending(row.householdMemberId, opt)}
                              className="h-4 w-4"
                              aria-label={`${row.memberName} ${attendingLabel(opt)}`}
                              data-testid={`attending-${row.householdMemberId}-${opt.toLowerCase()}`}
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="text-destructive text-sm" role="alert" data-testid="error-message">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-secondary text-foreground/85 rounded-lg px-4 py-2 text-sm font-medium"
            data-testid="cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isReadOnly || submitting}
            className="bg-terracotta rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="save"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add RSVP'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
