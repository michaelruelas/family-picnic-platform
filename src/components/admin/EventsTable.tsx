'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EventStatus } from '~/lib/generated/enums';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import EventActions from './EventActions';
import { formatDate } from '~/lib/format-date';

export interface AdminEventRow {
  id: string;
  name: string;
  date: string;
  status: EventStatus;
  location: string;
  rsvpCount: number;
  potluckSlotCount: number;
  maxCapacity: number | null;
  rsvpDeadline: string | null;
}

interface EventsTableProps {
  initialEvents: AdminEventRow[];
}

export default function EventsTable({ initialEvents }: EventsTableProps) {
  const router = useRouter();

  const columns = useMemo<DataTableColumn<AdminEventRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) => (
          <Link
            href={`/admin/events/${row.id}/edit`}
            className="text-foreground font-medium hover:underline"
          >
            {row.name}
          </Link>
        ),
      },
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'date',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value }) => (
          <span className="text-muted-foreground whitespace-nowrap">{formatDate(value)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        enableSorting: true,
        cell: ({ row }) => <EventStatusBadge status={row.status} />,
      },
      {
        id: 'location',
        header: 'Location',
        accessorKey: 'location',
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ value }) => <span className="text-muted-foreground">📍 {String(value)}</span>,
      },
      {
        id: 'rsvps',
        header: 'RSVPs',
        accessorKey: 'rsvpCount',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        className: 'tabular-nums',
      },
      {
        id: 'potluckSlots',
        header: 'Slots',
        accessorKey: 'potluckSlotCount',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        className: 'tabular-nums',
      },
      {
        id: 'capacity',
        header: 'Capacity',
        accessorKey: 'maxCapacity',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        cell: ({ value }) => {
          const v = value as number | null;
          if (v === null || v === undefined) {
            return <span className="text-muted-foreground/60">—</span>;
          }
          return <span className="tabular-nums">{v}</span>;
        },
      },
      {
        id: 'rsvpDeadline',
        header: 'RSVP by',
        accessorKey: 'rsvpDeadline',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value }) => {
          if (!value) return <span className="text-muted-foreground/60">—</span>;
          const deadline = new Date(String(value));
          const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
          const isImminent = daysUntil >= 0 && daysUntil <= 14;
          return (
            <span className={`whitespace-nowrap ${isImminent ? 'text-terracotta' : ''}`}>
              {formatDate(value, 'date')}
              {isImminent ? (
                <span className="text-muted-foreground ml-1 text-xs">({daysUntil}d)</span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <EventActions eventId={row.id} status={row.status} />
            <Link
              href={`/admin/events/${row.id}/edit`}
              className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-3 py-1 text-xs font-medium"
            >
              Edit
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={initialEvents}
      rowKey="id"
      pageSize={25}
      onRowClick={(row) => router.push(`/admin/events/${row.id}/edit`)}
      emptyState={{
        title: 'No events yet',
        description: 'Create your first event to get started.',
        icon: 'calendar',
      }}
    />
  );
}
