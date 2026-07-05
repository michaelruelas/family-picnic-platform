'use client';

import { useState } from 'react';
import type { AdminAuditLog, User, Event } from '~/lib/generated/client';

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-lg bg-white p-4 shadow-sm">
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

        <div className="flex items-end">
          <button
            onClick={handleFilter}
            disabled={loading}
            className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Filter'}
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-secondary rounded-2xl p-12 text-center">
          <div className="text-5xl">📋</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No Audit Logs</h2>
          <p className="text-muted-foreground mt-2">
            Audit logs will appear here as admin actions are performed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-secondary/60">
              <tr>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Timestamp
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  User
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Action
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Event
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-secondary/60">
                  <td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-foreground font-medium">{log.user.name || 'Unknown'}</div>
                    <div className="text-muted-foreground text-xs">{log.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <code className="bg-secondary rounded px-2 py-1 text-xs">{log.action}</code>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {log.event?.name || '-'}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs">
                    {log.oldValue || log.newValue ? (
                      <details className="cursor-pointer">
                        <summary className="text-terracotta hover:text-terracotta">
                          View JSON
                        </summary>
                        <pre className="bg-secondary mt-2 max-h-48 overflow-auto rounded p-2 text-xs">
                          {log.oldValue && (
                            <div className="mb-2">
                              <span className="text-destructive font-medium">Old:</span>{' '}
                              {formatJson(log.oldValue)}
                            </div>
                          )}
                          {log.newValue && (
                            <div>
                              <span className="text-sage font-medium">New:</span>{' '}
                              {formatJson(log.newValue)}
                            </div>
                          )}
                        </pre>
                      </details>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
