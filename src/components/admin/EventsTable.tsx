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
      className="bg-warning/20 text-warning-foreground hover:bg-warning/30 rounded-sm px-3 py-1 text-xs font-medium disabled:opacity-50"
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
      className="bg-sage/20 text-sage hover:bg-sage/30 rounded-sm px-3 py-1 text-xs font-medium disabled:opacity-50"
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

function CopyLinkButton({ eventId }: { eventId: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/events/${eventId}/rsvp`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.addToast('success', 'Invitation link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.addToast('error', 'Could not copy link');
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border bg-card text-foreground/80 hover:bg-secondary hover:text-foreground rounded-sm border px-3 py-1 text-xs font-medium"
      title="Copy universal invitation URL"
    >
      {copied ? 'Copied' : 'Copy Link'}
    </button>
  );
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
                <CopyLinkButton eventId={row.id} />
                <EventActions eventId={row.id} status={row.status} />
                {new Date(row.date).getTime() < Date.now() ? (
                  <ArchiveButton eventId={row.id} />
                ) : null}
              </>
            )}
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
