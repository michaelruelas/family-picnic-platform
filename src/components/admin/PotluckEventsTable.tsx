'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { EventStatus } from '~/lib/generated/enums';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import EventStatusBadge from '~/components/event/EventStatusBadge';

export interface AdminPotluckEventRow {
  id: string;
  name: string;
  date: string;
  status: EventStatus;
  slotCount: number;
  signupCount: number;
}

interface PotluckEventsTableProps {
  initialRows: AdminPotluckEventRow[];
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export default function PotluckEventsTable({ initialRows }: PotluckEventsTableProps) {
  const columns = useMemo<DataTableColumn<AdminPotluckEventRow>[]>(
    () => [
      {
        id: 'event',
        header: 'Event',
        accessorFn: (row) => row.name,
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) => (
          <div>
            <div className="text-foreground font-medium">{row.name}</div>
            <div className="text-muted-foreground text-xs">
              {dateFormatter.format(new Date(row.date))}
            </div>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) => <EventStatusBadge status={row.status} />,
      },
      {
        id: 'slots',
        header: 'Slots',
        accessorKey: 'slotCount',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        cell: ({ value }) => <span className="text-foreground tabular-nums">{String(value)}</span>,
      },
      {
        id: 'signups',
        header: 'Signups',
        accessorKey: 'signupCount',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        cell: ({ value }) => <span className="text-foreground tabular-nums">{String(value)}</span>,
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/events/${row.id}/potluck`}
            className="bg-terracotta hover:bg-terracotta inline-block rounded-sm px-3 py-1.5 text-xs font-medium text-white"
            data-testid={`manage-potluck-${row.id}`}
          >
            Manage signups
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={initialRows}
      rowKey="id"
      pageSize={25}
      emptyState={{
        title: 'No events with potluck',
        description: 'Events appear here once a host opens a potluck slot.',
        icon: 'list',
      }}
    />
  );
}
