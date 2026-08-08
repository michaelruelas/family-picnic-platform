'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { RsvpAttending, RSVPStatus, type EventStatus } from '~/lib/generated/enums';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';

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
}

interface MembersTableProps {
  initialRows: AdminMemberRow[];
  eventId: string;
  eventStatus: EventStatus;
  eventName: string;
  eventDate: string;
  counts: Record<RsvpAttending, number>;
}

const ATTENDING_PALETTE: Record<RsvpAttending, string> = {
  [RsvpAttending.YES]: 'bg-sage/20 text-sage',
  [RsvpAttending.MAYBE]: 'bg-sunlight/30 text-[#a07c2f]',
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
}: MembersTableProps) {
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
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ATTENDING_PALETTE[row.attending] ?? 'bg-secondary text-foreground/85'}`}
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
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RSVP_PALETTE[row.rsvpStatus] ?? 'bg-secondary text-foreground/85'}`}
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

  return (
    <div className="space-y-4">
      <div className="border-border flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <p className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
            Admin · Members
          </p>
          <h2 className="text-foreground mt-1 text-2xl font-bold">{eventName}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{eventDate}</p>
        </div>
        <div className="flex items-center gap-3">
          <EventStatusBadge status={eventStatus} />
          <Link
            href={`/admin/events/${eventId}/edit`}
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            Back to event
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Going</p>
          <p className="text-sage mt-1 text-2xl font-semibold tabular-nums">
            {counts[RsvpAttending.YES]}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Maybe</p>
          <p className="mt-1 text-2xl font-semibold text-[#a07c2f] tabular-nums">
            {counts[RsvpAttending.MAYBE]}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
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
        emptyState={{
          title: 'No members yet',
          description: 'Once households respond, you’ll see per-member attendance here.',
          icon: 'users',
        }}
      />
    </div>
  );
}
