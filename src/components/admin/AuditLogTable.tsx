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
          <label className="block text-sm font-medium text-stone-600">Event</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
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
          <label className="block text-sm font-medium text-stone-600">User</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
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
          <label className="block text-sm font-medium text-stone-600">Action</label>
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g., event.create"
            className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleFilter}
            disabled={loading}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Filter'}
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl bg-stone-100 p-12 text-center">
          <div className="text-5xl">📋</div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">No Audit Logs</h2>
          <p className="mt-2 text-stone-600">
            Audit logs will appear here as admin actions are performed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-stone-500 uppercase">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-stone-500 uppercase">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-stone-500 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-stone-500 uppercase">
                  Event
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-stone-500 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-stone-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-stone-900">{log.user.name || 'Unknown'}</div>
                    <div className="text-xs text-stone-500">{log.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <code className="rounded bg-stone-100 px-2 py-1 text-xs">{log.action}</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">{log.event?.name || '-'}</td>
                  <td className="max-w-xs px-4 py-3 text-xs">
                    {log.oldValue || log.newValue ? (
                      <details className="cursor-pointer">
                        <summary className="text-amber-600 hover:text-amber-700">View JSON</summary>
                        <pre className="mt-2 max-h-48 overflow-auto rounded bg-stone-100 p-2 text-xs">
                          {log.oldValue && (
                            <div className="mb-2">
                              <span className="font-medium text-red-600">Old:</span>{' '}
                              {formatJson(log.oldValue)}
                            </div>
                          )}
                          {log.newValue && (
                            <div>
                              <span className="font-medium text-green-600">New:</span>{' '}
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
