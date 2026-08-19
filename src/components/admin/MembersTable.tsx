'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { RsvpAttending, RSVPStatus, type EventStatus } from '~/lib/generated/enums';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import AdminRsvpModal, { type AdminRsvpModalMember } from './AdminRsvpModal';

export interface AdminMemberRow {
  id: string;
  memberName: string;
  memberAge: number | null;
  relationship: string | null;
  attending: RsvpAttending;
  rsvpStatus: RSVPStatus;
  householdId: string | null;
  householdName: string;
  rsvpId: string;
  respondedAt: string | null;
  /**
   * FPP-102: the userId the RSVP belongs to. Surfaced so the
   * modal can re-fetch via tRPC.getById keyed on rsvpId (which is
   * stable across edits). Kept on the row to avoid an extra
   * round-trip when the admin clicks a member.
   */
  userId: string;
  userName: string;
  userEmail: string;
}

type AttendanceFilter = 'all' | RsvpAttending;

export interface AdminHouseholdOption {
  userId: string;
  userName: string;
  userEmail: string;
  householdId: string;
  householdName: string;
  members: AdminRsvpModalMember[];
}

interface MembersTableProps {
  initialRows: AdminMemberRow[];
  eventId: string;
  eventStatus: EventStatus;
  eventName: string;
  eventDate: string;
  counts: Record<RsvpAttending, number>;
  /**
   * FPP-102: households that do not yet have an RSVP for this
   * event. Surfaced in the "Add RSVP" picker. The page is
   * responsible for filtering out households that already appear
   * in `initialRows`.
   */
  availableHouseholds: AdminHouseholdOption[];
}

const ATTENDING_PALETTE: Record<RsvpAttending, string> = {
  [RsvpAttending.YES]: 'bg-sage/20 text-sage',
  [RsvpAttending.MAYBE]: 'bg-sunlight/25 text-sunlight-foreground',
  [RsvpAttending.NO]: 'bg-destructive/15 text-destructive',
};

const RSVP_PALETTE: Record<RSVPStatus, string> = {
  CONFIRMED: 'bg-sage/20 text-sage',
  DECLINED: 'bg-destructive/15 text-destructive',
  WAITLISTED: 'bg-terracotta/15 text-terracotta',
  PENDING: 'bg-secondary text-foreground/85',
  INVITED: 'bg-secondary text-foreground/85',
};

function rsvpStatusLabel(status: RSVPStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function MembersTable({
  initialRows,
  eventId,
  eventStatus,
  eventName,
  eventDate,
  counts,
  availableHouseholds,
}: MembersTableProps) {
  const [editingRsvpId, setEditingRsvpId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<AdminMemberRow | null>(null);
  const [addingHousehold, setAddingHousehold] = useState<AdminHouseholdOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const isReadOnly = eventStatus === 'CANCELLED';

  // FPP-138: focus the page on members + going/not-coming. The
  // toolbar filter narrows the table to one bucket at a time;
  // the per-member Attendance badge + the Going/Maybe/Not-going
  // counter tiles keep the bucket context visible above and
  // inside the table.
  const filteredRows = useMemo(() => {
    if (attendanceFilter === 'all') return initialRows;
    return initialRows.filter((row) => row.attending === attendanceFilter);
  }, [initialRows, attendanceFilter]);

  // Close the household picker on click-outside or Escape so it
  // does not dangle after the admin has scrolled away. Mirrors
  // the same UX in the existing column-toggle menu.
  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  const columns = useMemo<DataTableColumn<AdminMemberRow>[]>(
    () => [
      {
        id: 'memberName',
        header: 'Name',
        accessorKey: 'memberName',
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row, value }) => (
          <div>
            <div className="text-foreground font-medium">{String(value)}</div>
            <div className="text-muted-foreground text-xs">
              {row.relationship ? `${row.relationship} · ` : ''}
              {row.householdName}
            </div>
          </div>
        ),
      },
      {
        id: 'memberAge',
        header: 'Age',
        accessorKey: 'memberAge',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        cell: ({ value }) =>
          value === null || value === undefined ? (
            <span className="text-muted-foreground/60">—</span>
          ) : (
            <span className="tabular-nums">{String(value)}</span>
          ),
      },
      {
        id: 'attending',
        header: 'Attendance',
        accessorKey: 'attending',
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${ATTENDING_PALETTE[row.attending] ?? 'bg-secondary text-foreground/85'}`}
          >
            {attendingLabel(row.attending)}
          </span>
        ),
      },
      {
        id: 'rsvpStatus',
        header: 'RSVP',
        accessorKey: 'rsvpStatus',
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${RSVP_PALETTE[row.rsvpStatus] ?? 'bg-secondary text-foreground/85'}`}
          >
            {rsvpStatusLabel(row.rsvpStatus)}
          </span>
        ),
      },
      {
        id: 'householdName',
        header: 'Household',
        accessorKey: 'householdName',
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ value }) => <span className="text-muted-foreground">{String(value)}</span>,
      },
      {
        id: 'respondedAt',
        header: 'Responded',
        accessorKey: 'respondedAt',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value }) =>
          value ? (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {new Date(String(value)).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          ),
      },
    ],
    [],
  );

  function openEdit(row: AdminMemberRow) {
    if (isReadOnly) return;
    setEditingRsvpId(row.rsvpId);
    setEditingRow(row);
  }

  function closeEdit() {
    setEditingRsvpId(null);
    setEditingRow(null);
  }

  function openAdd(household: AdminHouseholdOption) {
    setAddingHousehold(household);
    setPickerOpen(false);
  }

  function closeAdd() {
    setAddingHousehold(null);
  }

  function toggleAttendanceFilter(bucket: RsvpAttending) {
    // Clicking the already-active counter clears the filter back
    // to All; clicking an inactive counter narrows the table to
    // that bucket. The toggle matches the user's mental model
    // ("I want everyone" → "I want just Going" → "I want everyone
    // again") and keeps the tiles useful as a quick clear control.
    setAttendanceFilter((current) => (current === bucket ? 'all' : bucket));
  }

  return (
    <div className="space-y-4">
      <div className="border-border bg-card flex flex-wrap items-start justify-between gap-3 rounded-sm p-5 shadow-sm">
        <div>
          <p className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
            Admin · Members
          </p>
          <h2 className="text-foreground mt-1 text-2xl font-bold">{eventName}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{eventDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EventStatusBadge status={eventStatus} />
          {!isReadOnly && availableHouseholds.length > 0 ? (
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="bg-sage text-sage-foreground hover:bg-sage-hover rounded-sm px-3 py-1.5 text-sm font-medium"
                data-testid="add-rsvp-button"
                aria-haspopup="menu"
                aria-expanded={pickerOpen}
              >
                + Add RSVP
              </button>
              {pickerOpen ? (
                <div
                  className="border-border bg-card absolute right-0 z-20 mt-1 w-80 rounded-sm border p-2 shadow-lg"
                  data-testid="add-rsvp-picker"
                  role="menu"
                >
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wider uppercase">
                    Pick a household
                  </p>
                  <div className="max-h-72 overflow-y-auto">
                    {availableHouseholds.map((household) => (
                      <button
                        key={household.userId}
                        type="button"
                        onClick={() => openAdd(household)}
                        className="hover:bg-secondary flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left text-sm"
                        role="menuitem"
                        data-testid={`add-rsvp-option-${household.userId}`}
                      >
                        <span className="text-foreground font-medium">
                          {household.householdName}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {household.userName} · {household.userEmail}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <Link
            href={`/admin/events/${eventId}/edit`}
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1.5 text-sm font-medium"
          >
            Back to event
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => toggleAttendanceFilter(RsvpAttending.YES)}
          aria-pressed={attendanceFilter === RsvpAttending.YES}
          className={`bg-card hover:bg-secondary/40 rounded-sm p-4 text-left shadow-sm transition ${
            attendanceFilter === RsvpAttending.YES ? 'ring-sage ring-2' : ''
          }`}
          data-testid="counter-going"
        >
          <p className="text-muted-foreground text-xs">Going</p>
          <p className="text-sage mt-1 text-2xl font-semibold tabular-nums">
            {counts[RsvpAttending.YES]}
          </p>
        </button>
        <button
          type="button"
          onClick={() => toggleAttendanceFilter(RsvpAttending.MAYBE)}
          aria-pressed={attendanceFilter === RsvpAttending.MAYBE}
          className={`bg-card hover:bg-secondary/40 rounded-sm p-4 text-left shadow-sm transition ${
            attendanceFilter === RsvpAttending.MAYBE ? 'ring-sunlight ring-2' : ''
          }`}
          data-testid="counter-maybe"
        >
          <p className="text-muted-foreground text-xs">Maybe</p>
          <p className="text-sunlight-foreground mt-1 text-2xl font-semibold tabular-nums">
            {counts[RsvpAttending.MAYBE]}
          </p>
        </button>
        <button
          type="button"
          onClick={() => toggleAttendanceFilter(RsvpAttending.NO)}
          aria-pressed={attendanceFilter === RsvpAttending.NO}
          className={`bg-card hover:bg-secondary/40 rounded-sm p-4 text-left shadow-sm transition ${
            attendanceFilter === RsvpAttending.NO ? 'ring-destructive ring-2' : ''
          }`}
          data-testid="counter-not-going"
        >
          <p className="text-muted-foreground text-xs">Not going</p>
          <p className="text-destructive mt-1 text-2xl font-semibold tabular-nums">
            {counts[RsvpAttending.NO]}
          </p>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        rowKey="id"
        pageSize={50}
        onRowClick={isReadOnly ? undefined : openEdit}
        emptyState={
          attendanceFilter === 'all'
            ? {
                title: 'No members yet',
                description: 'Once households respond, you’ll see per-member attendance here.',
                icon: 'users',
              }
            : {
                title: `No ${attendingLabel(attendanceFilter).toLowerCase()} members`,
                description: 'Switch the filter to "All" to see every member.',
                icon: 'users',
              }
        }
        toolbar={
          <div>
            <label
              htmlFor="attendance-filter"
              className="text-muted-foreground block text-xs font-medium tracking-wider uppercase"
            >
              Attendance
            </label>
            <select
              id="attendance-filter"
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value as AttendanceFilter)}
              className="border-border mt-1 rounded-sm border px-3 py-1.5 text-sm"
              data-testid="attendance-filter"
            >
              <option value="all">All ({initialRows.length})</option>
              <option value={RsvpAttending.YES}>Going ({counts[RsvpAttending.YES]})</option>
              <option value={RsvpAttending.MAYBE}>Maybe ({counts[RsvpAttending.MAYBE]})</option>
              <option value={RsvpAttending.NO}>Not going ({counts[RsvpAttending.NO]})</option>
            </select>
          </div>
        }
      />

      {editingRsvpId && editingRow ? (
        // `key` ensures a fresh modal mount when the admin
        // opens a different row. The conditional render above
        // already forces an unmount, but the explicit key
        // documents the contract and protects against future
        // refactors that change the close-then-open sequencing.
        <AdminRsvpModal
          key={`edit-${editingRsvpId}`}
          eventId={eventId}
          eventName={eventName}
          eventStatus={eventStatus}
          rsvpId={editingRsvpId}
          targetUser={{
            id: editingRow.userId,
            name: editingRow.userName,
            email: editingRow.userEmail,
            householdName: editingRow.householdName,
          }}
          onClose={closeEdit}
        />
      ) : null}

      {addingHousehold ? (
        <AdminRsvpModal
          key={`add-${addingHousehold.userId}`}
          eventId={eventId}
          eventName={eventName}
          eventStatus={eventStatus}
          targetUser={{
            id: addingHousehold.userId,
            name: addingHousehold.userName,
            email: addingHousehold.userEmail,
            householdName: addingHousehold.householdName,
          }}
          members={addingHousehold.members}
          onClose={closeAdd}
        />
      ) : null}
    </div>
  );
}
