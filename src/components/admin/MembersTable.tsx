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
  dishName: string | null;
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
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const isReadOnly = eventStatus === 'CANCELLED';

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
        id: 'dishName',
        header: 'Dish',
        accessorKey: 'dishName',
        cell: ({ value }) =>
          value ? (
            <span className="text-foreground">{String(value)}</span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          ),
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
        <div className="bg-card rounded-sm p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Going</p>
          <p className="text-sage mt-1 text-2xl font-semibold tabular-nums">
            {counts[RsvpAttending.YES]}
          </p>
        </div>
        <div className="bg-card rounded-sm p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Maybe</p>
          <p className="text-sunlight-foreground mt-1 text-2xl font-semibold tabular-nums">
            {counts[RsvpAttending.MAYBE]}
          </p>
        </div>
        <div className="bg-card rounded-sm p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Not going</p>
          <p className="text-destructive mt-1 text-2xl font-semibold tabular-nums">
            {counts[RsvpAttending.NO]}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={initialRows}
        rowKey="id"
        pageSize={50}
        onRowClick={isReadOnly ? undefined : openEdit}
        emptyState={{
          title: 'No members yet',
          description: 'Once households respond, you’ll see per-member attendance here.',
          icon: 'users',
        }}
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
