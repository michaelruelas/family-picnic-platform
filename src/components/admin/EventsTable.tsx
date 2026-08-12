'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EventStatus } from '~/lib/generated/enums';
import DataTable, {
  type DataTableColumn,
  type DataTableEmptyState,
} from '~/components/ui/DataTable';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import EventActions from './EventActions';
import { formatDate } from '~/lib/format-date';
import { useToast } from '~/components/ui/Toast';

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
  // FPP-68 / QUB-12: archived timestamp. Null when the event has
  // never been archived (pre-FPP-68 rows + future rows). Serialised
  // as an ISO string from the server component so the client can
  // render "Archived on <date>" inline.
  archivedAt: string | null;
}

interface EventsTableProps {
  initialEvents: AdminEventRow[];
  // FPP-68 / QUB-12: 'past' swaps the empty-state copy and the
  // action column buttons (restore instead of publish/close).
  mode?: 'active' | 'past';
  // Override the empty-state copy/icon when `mode === 'past'`.
  // The icon type is borrowed from the DataTable parent so any
  // icon the empty-state component accepts is allowed here without
  // re-declaring a subset.
  emptyPastState?: Omit<DataTableEmptyState, 'action'>;
}

// FPP-68 / QUB-12: archive / restore buttons rendered in the
// action column. The active table exposes Archive (only when the
// event's date has passed — it does not make sense to archive a
// future event), the past table exposes Restore for every row.
// Both buttons surface a toast on failure (401/403/404/500) so the
// caller is never silently left wondering whether the click landed.
function ArchiveButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/archive`, { method: 'POST' });
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Could not archive the event');
        toast.addToast('error', message);
        return;
      }
      router.refresh();
    } catch (err) {
      toast.addToast('error', err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
    >
      {busy ? 'Archiving...' : 'Archive'}
    </button>
  );
}

function RestoreButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/unarchive`, { method: 'POST' });
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Could not restore the event');
        toast.addToast('error', message);
        return;
      }
      router.refresh();
    } catch (err) {
      toast.addToast('error', err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="bg-sage/20 text-sage hover:bg-sage/30 rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50"
    >
      {busy ? 'Restoring...' : 'Restore'}
    </button>
  );
}

// Read the JSON `{ error }` shape the REST routes emit; fall back to
// the generic message when the body is not JSON or has no error field.
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Body wasn't JSON — use the fallback.
  }
  return fallback;
}

export default function EventsTable({
  initialEvents,
  mode = 'active',
  emptyPastState,
}: EventsTableProps) {
  const router = useRouter();
  const isPast = mode === 'past';

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
      // FPP-68 / QUB-12: "Archived on" column. Shows the archive
      // timestamp when present, "—" otherwise. Past events surface
      // here even when archivedAt is null (legacy rows whose date
      // has passed but were never explicitly archived).
      {
        id: 'archivedAt',
        header: 'Archived on',
        accessorKey: 'archivedAt',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value }) => {
          if (!value) return <span className="text-muted-foreground/60">—</span>;
          return (
            <span className="text-muted-foreground whitespace-nowrap">
              {formatDate(value, 'date')}
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
            {isPast ? (
              <RestoreButton eventId={row.id} />
            ) : (
              <>
                <EventActions eventId={row.id} status={row.status} />
                {new Date(row.date).getTime() < Date.now() ? (
                  <ArchiveButton eventId={row.id} />
                ) : null}
              </>
            )}
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
    [isPast],
  );

  return (
    <DataTable
      columns={columns}
      data={initialEvents}
      rowKey="id"
      pageSize={25}
      onRowClick={(row) => router.push(`/admin/events/${row.id}/edit`)}
      emptyState={
        isPast && emptyPastState
          ? emptyPastState
          : {
              title: 'No events yet',
              description: 'Create your first event to get started.',
              icon: 'calendar',
            }
      }
    />
  );
}
