'use client';

import { useState } from 'react';
import type { AdminAuditLog, User, Event } from '~/lib/generated/client';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';

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
  const [logs, setLogs] = useState(initialLogs);
  const [eventId, setEventId] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleFilter() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventId) params.set('eventId', eventId);
      if (userId) params.set('userId', userId);
      if (action) params.set('action', action);

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

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
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(String(value)).toLocaleString()}
        </span>
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
      cell: ({ value }) => (
        <span className="text-muted-foreground">
          {(value as AuditLogWithRelations['event'])?.name || '-'}
        </span>
      ),
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
      data={logs}
      rowKey="id"
      loading={loading}
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
            onClick={handleFilter}
            disabled={loading}
            className="bg-terracotta hover:bg-terracotta self-end rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Filter'}
          </button>
        </>
      }
    />
  );
}
