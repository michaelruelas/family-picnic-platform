'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import EventActions from './EventActions';
import { formatAmount } from '~/lib/currency';
import { formatDate } from '~/lib/format-date';
import type { EventStatus as EventStatusType } from '~/lib/generated/enums';

export interface AdminDashboardRow {
  id: string;
  name: string;
  date: string;
  status: EventStatusType;
  location: string;
  maxCapacity: number | null;
  rsvpTotal: number;
  rsvpConfirmed: number;
  rsvpDeclined: number;
  rsvpPending: number;
  headcount: number;
  potluckSlotCount: number;
  potluckSignupCount: number;
  chargesTotalCents: number;
  lastActionAt: string | null;
  lastActionBy: string | null;
}

interface DashboardTableProps {
  rows: AdminDashboardRow[];
}

function formatHeadcount(value: number): string {
  return value.toLocaleString('en-US');
}

export default function DashboardTable({ rows }: DashboardTableProps) {
  const router = useRouter();

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        rsvpTotal: acc.rsvpTotal + r.rsvpTotal,
        rsvpConfirmed: acc.rsvpConfirmed + r.rsvpConfirmed,
        headcount: acc.headcount + r.headcount,
        chargesTotalCents: acc.chargesTotalCents + r.chargesTotalCents,
      }),
      { rsvpTotal: 0, rsvpConfirmed: 0, headcount: 0, chargesTotalCents: 0 },
    );
  }, [rows]);

  const columns = useMemo<DataTableColumn<AdminDashboardRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Event',
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
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(value, 'date')}
          </span>
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
        id: 'rsvpTotal',
        header: 'RSVPs',
        accessorKey: 'rsvpTotal',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        className: 'tabular-nums',
      },
      {
        id: 'rsvpConfirmed',
        header: 'Confirmed',
        accessorKey: 'rsvpConfirmed',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        cell: ({ value }) => {
          const v = value as number;
          return (
            <span className={v > 0 ? 'text-sage font-semibold tabular-nums' : 'tabular-nums'}>
              {v}
            </span>
          );
        },
      },
      {
        id: 'headcount',
        header: 'Headcount',
        accessorKey: 'headcount',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        className: 'tabular-nums',
      },
      {
        id: 'potluckSignupCount',
        header: 'Dishes',
        accessorKey: 'potluckSignupCount',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        className: 'tabular-nums',
      },
      {
        id: 'chargesTotalCents',
        header: 'Charges',
        accessorKey: 'chargesTotalCents',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        cell: ({ value }) => (
          <span className="text-foreground tabular-nums">
            {formatAmount((value as number) ?? 0)}
          </span>
        ),
      },
      {
        id: 'lastActionAt',
        header: 'Last action',
        accessorKey: 'lastActionAt',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value, row }) => {
          if (!value) return <span className="text-muted-foreground/60">—</span>;
          return (
            <div>
              <div className="text-muted-foreground text-xs whitespace-nowrap">
                {formatDate(value, 'date')}
              </div>
              {row.lastActionBy ? (
                <div className="text-muted-foreground/70 text-xs">{row.lastActionBy}</div>
              ) : null}
            </div>
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
              className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1 text-xs font-medium"
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
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        <div className="bg-card rounded-sm p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Total RSVPs</p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
            {formatHeadcount(totals.rsvpTotal)}
          </p>
        </div>
        <div className="bg-card rounded-sm p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Total Confirmed</p>
          <p className="text-sage mt-1 text-2xl font-semibold tabular-nums">
            {formatHeadcount(totals.rsvpConfirmed)}
          </p>
        </div>
        <div className="bg-card rounded-sm p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Total Headcount</p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
            {formatHeadcount(totals.headcount)}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey="id"
        pageSize={25}
        onRowClick={(row) => router.push(`/admin/events/${row.id}/edit`)}
        emptyState={{
          title: 'No events yet',
          description: 'Create your first event to start seeing dashboard metrics.',
          icon: 'calendar',
          action: (
            <Link
              href="/admin/events/new"
              className="bg-terracotta hover:bg-terracotta rounded-sm px-4 py-2 font-medium text-white"
            >
              Create First Event
            </Link>
          ),
        }}
      />
    </div>
  );
}
