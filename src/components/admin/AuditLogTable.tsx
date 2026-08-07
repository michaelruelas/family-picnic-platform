'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdminAuditLog, User, Event } from '~/lib/generated/client';
import { trpc } from '~/lib/trpc-client';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import { useToast } from '~/components/ui/Toast';
import { formatDate } from '~/lib/format-date';

type AuditLogWithRelations = AdminAuditLog & {
  user: Pick<User, 'id' | 'name' | 'email'>;
  event: Pick<Event, 'id' | 'name'> | null;
};

interface AuditLogTableProps {
  initialLogs: AuditLogWithRelations[];
  events: Pick<Event, 'id' | 'name'>[];
  users: Pick<User, 'id' | 'name' | 'email'>[];
}

export default function AuditLogTable({ initialLogs, events, users }: AuditLogTableProps) {
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');

  // tRPC handles in-flight cancellation via react-query under the hood: a
  // new query auto-aborts the previous one, so a hung server cannot leave
  // the user blocked on a stale request. See docs/agents/CONVENTIONS.md
  // for the tRPC-for-all-client-server rule this replaces.
  const logsQuery = trpc.admin.auditLog.useQuery(
    {
      ...(eventId ? { eventId } : {}),
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
    },
    { initialData: initialLogs },
  );

  // Toast once per error so a stale query doesn't spam the toast queue.
  // `lastErrorRef` tracks the error identity (message) so identical retries
  // surface only one toast until a new error arrives.
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (logsQuery.error && !logsQuery.isFetching) {
      const message = logsQuery.error.message;
      if (lastErrorRef.current !== message) {
        lastErrorRef.current = message;
        toast.addToast('error', message);
      }
    } else if (!logsQuery.error) {
      lastErrorRef.current = null;
    }
  }, [logsQuery.error, logsQuery.isFetching, toast]);

  function formatJson(value: unknown): string {
    if (value === null || value === undefined) return '-';
    return JSON.stringify(value, null, 2);
  }

  const columns: DataTableColumn<AuditLogWithRelations>[] = [
    {
      id: 'timestamp',
      header: 'Timestamp',
      accessorKey: 'createdAt',
      enableSorting: true,
      sortFn: 'datetime',
      cell: ({ value }) => (
        <span className="text-muted-foreground whitespace-nowrap">{formatDate(value)}</span>
      ),
    },
    {
      id: 'user',
      header: 'User',
      accessorKey: 'user',
      cell: ({ row }) => (
        <div>
          <div className="text-foreground font-medium">{row.user.name || 'Unknown'}</div>
          <div className="text-muted-foreground text-xs">{row.user.email}</div>
        </div>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      accessorKey: 'action',
      enableSorting: true,
      cell: ({ value }) => (
        <code className="bg-secondary rounded px-2 py-1 text-xs">{String(value)}</code>
      ),
    },
    {
      id: 'event',
      header: 'Event',
      accessorKey: 'event',
      cell: ({ row }) => <span className="text-muted-foreground">{row.event?.name || '-'}</span>,
    },
    {
      id: 'details',
      header: 'Details',
      enableSorting: false,
      cell: ({ row }) =>
        row.oldValue || row.newValue ? (
          <details className="cursor-pointer text-xs">
            <summary className="text-terracotta hover:text-terracotta">View JSON</summary>
            <pre className="bg-secondary mt-2 max-h-48 overflow-auto rounded p-2 text-xs">
              {row.oldValue ? (
                <div className="mb-2">
                  <span className="text-destructive font-medium">Old:</span>{' '}
                  {formatJson(row.oldValue)}
                </div>
              ) : null}
              {row.newValue ? (
                <div>
                  <span className="text-sage font-medium">New:</span> {formatJson(row.newValue)}
                </div>
              ) : null}
            </pre>
          </details>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={logsQuery.data ?? initialLogs}
      rowKey="id"
      loading={logsQuery.isFetching}
      pageSize={50}
      syncWithUrl
      paramPrefix="audit_"
      emptyState={{
        title: 'No Audit Logs',
        description: 'Audit logs will appear here as admin actions are performed.',
        icon: 'inbox',
      }}
      toolbar={
        <>
          <div>
            <label className="text-muted-foreground block text-sm font-medium">Event</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All Events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground block text-sm font-medium">User</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground block text-sm font-medium">Action</label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g., event.create"
              className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => logsQuery.refetch()}
            disabled={logsQuery.isFetching}
            className="bg-terracotta hover:bg-terracotta self-end rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {logsQuery.isFetching ? 'Loading...' : 'Filter'}
          </button>
        </>
      }
    />
  );
}
