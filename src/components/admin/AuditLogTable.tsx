'use client';

import { useEffect, useRef, useState } from 'react';
import type { User, Event } from '~/lib/generated/client';
import { trpc } from '~/lib/trpc-client';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import { useToast } from '~/components/ui/Toast';
import { formatDate } from '~/lib/format-date';
import type { AuditLogEntryView } from '~/lib/schemas/audit';

interface AuditLogTableProps {
  initialLogs: AuditLogEntryView[];
  events: Pick<Event, 'id' | 'name'>[];
  users: Pick<User, 'id' | 'name' | 'email'>[];
}

const SUBJECT_TYPES = ['RSVP', 'PotluckSignup', 'EventAdmin', 'Registration', 'Charge'] as const;

export default function AuditLogTable({ initialLogs, events, users }: AuditLogTableProps) {
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // tRPC handles in-flight cancellation via react-query under the hood: a
  // new query auto-aborts the previous one, so a hung server cannot leave
  // the user blocked on a stale request. See docs/agents/CONVENTIONS.md
  // for the tRPC-for-all-client-server rule this replaces.
  const logsQuery = trpc.admin.auditLog.useQuery(
    {
      ...(eventId ? { eventId } : {}),
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(subjectType ? { subjectType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
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

  const columns: DataTableColumn<AuditLogEntryView>[] = [
    {
      id: 'timestamp',
      header: 'Timestamp',
      accessorKey: 'occurredAt',
      enableSorting: true,
      sortFn: 'datetime',
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatDate(row.occurredAt)}
        </span>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      accessorKey: 'source',
      cell: ({ row }) => (
        <span
          className={
            row.source === 'admin'
              ? 'bg-secondary rounded px-2 py-1 text-xs'
              : 'bg-terracotta/10 text-terracotta rounded px-2 py-1 text-xs'
          }
        >
          {row.source}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      accessorKey: 'actor',
      cell: ({ row }) =>
        row.actor ? (
          <div>
            <div className="text-foreground font-medium">{row.actor.name || 'Unknown'}</div>
            <div className="text-muted-foreground text-xs">{row.actor.email}</div>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">system</span>
        ),
    },
    {
      id: 'action',
      header: 'Action',
      accessorKey: 'action',
      enableSorting: true,
      cell: ({ row }) => (
        <code className="bg-secondary rounded px-2 py-1 text-xs">{row.action}</code>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      accessorKey: 'subjectType',
      cell: ({ row }) =>
        row.source === 'admin' ? (
          <span className="text-muted-foreground">{row.eventName || row.eventId || '-'}</span>
        ) : (
          <span>
            {row.subjectType ? (
              <span className="text-foreground block font-medium">{row.subjectType}</span>
            ) : null}
            {row.subjectId ? (
              <code className="text-muted-foreground text-xs">{row.subjectId}</code>
            ) : null}
          </span>
        ),
    },
    {
      id: 'details',
      header: 'Details',
      enableSorting: false,
      cell: ({ row }) => {
        if (row.source === 'admin' && (row.oldValue !== undefined || row.newValue !== undefined)) {
          return (
            <details className="cursor-pointer">
              <summary className="text-terracotta hover:text-terracotta">View JSON</summary>
              <pre className="bg-secondary mt-2 max-h-48 overflow-auto rounded p-2 text-xs">
                {row.oldValue !== undefined && (
                  <div className="mb-2">
                    <span className="text-destructive font-medium">Old:</span>{' '}
                    {formatJson(row.oldValue)}
                  </div>
                )}
                {row.newValue !== undefined && (
                  <div>
                    <span className="text-sage font-medium">New:</span> {formatJson(row.newValue)}
                  </div>
                )}
              </pre>
            </details>
          );
        }
        if (row.source === 'domain' && row.payload !== undefined) {
          return (
            <details className="cursor-pointer">
              <summary className="text-terracotta hover:text-terracotta">View JSON</summary>
              <pre className="bg-secondary mt-2 max-h-48 overflow-auto rounded p-2 text-xs">
                {formatJson(row.payload)}
              </pre>
            </details>
          );
        }
        return <>-</>;
      },
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
        description: 'Audit logs will appear here as admin actions and domain events occur.',
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
            <label className="text-muted-foreground block text-sm font-medium">Actor</label>
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
          <div>
            <label className="text-muted-foreground block text-sm font-medium">Subject type</label>
            <select
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value)}
              className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {SUBJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground block text-sm font-medium">Subject ID</label>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="e.g., rsvp id"
              className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-muted-foreground block text-sm font-medium">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-muted-foreground block text-sm font-medium">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
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
