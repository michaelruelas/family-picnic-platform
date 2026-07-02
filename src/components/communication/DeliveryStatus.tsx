'use client';

type DeliveryLog = {
  id: string;
  eventId: string;
  sentByUserId: string;
  recipientUserId: string | null;
  channel: 'EMAIL' | 'SMS';
  messageId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  attemptedAt: string | Date;
  deliveredAt: string | Date | null;
  recipient: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type DeliveryStatusProps = {
  logs: DeliveryLog[];
  loading?: boolean;
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    QUEUED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Queued' },
    SENT: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
    DELIVERED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
    UNSUBSCRIBED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Unsubscribed' },
  };

  const { bg, text, label } = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

export default function DeliveryStatus({ logs, loading = false }: DeliveryStatusProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
        <span className="ml-2 text-stone-600">Loading delivery status...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl bg-stone-100 p-8 text-center">
        <div className="text-4xl">📭</div>
        <h3 className="mt-2 text-lg font-medium text-stone-900">No Messages Sent</h3>
        <p className="mt-1 text-stone-600">Send a broadcast message to see delivery status here.</p>
      </div>
    );
  }

  const summary = {
    total: logs.length,
    queued: logs.filter((l) => l.status === 'QUEUED').length,
    sent: logs.filter((l) => l.status === 'SENT').length,
    delivered: logs.filter((l) => l.status === 'DELIVERED').length,
    failed: logs.filter((l) => l.status === 'FAILED').length,
    unsubscribed: logs.filter((l) => l.status === 'UNSUBSCRIBED').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 text-center text-sm">
        <div className="rounded-lg bg-stone-100 p-3">
          <div className="text-2xl font-bold text-stone-900">{summary.total}</div>
          <div className="text-stone-600">Total</div>
        </div>
        <div className="rounded-lg bg-yellow-100 p-3">
          <div className="text-2xl font-bold text-yellow-700">{summary.queued}</div>
          <div className="text-yellow-600">Queued</div>
        </div>
        <div className="rounded-lg bg-blue-100 p-3">
          <div className="text-2xl font-bold text-blue-700">{summary.sent}</div>
          <div className="text-blue-600">Sent</div>
        </div>
        <div className="rounded-lg bg-green-100 p-3">
          <div className="text-2xl font-bold text-green-700">{summary.delivered}</div>
          <div className="text-green-600">Delivered</div>
        </div>
        <div className="rounded-lg bg-red-100 p-3">
          <div className="text-2xl font-bold text-red-700">{summary.failed}</div>
          <div className="text-red-600">Failed</div>
        </div>
        <div className="rounded-lg bg-gray-100 p-3">
          <div className="text-2xl font-bold text-gray-700">{summary.unsubscribed}</div>
          <div className="text-gray-600">Unsubscribed</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Recipient
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Channel
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Attempted
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Delivered
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-stone-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium text-stone-900">
                    {log.recipient?.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-stone-500">
                    {log.recipient?.email || log.recipientUserId}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">
                    {log.channel}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={log.status} />
                  {log.errorMessage && (
                    <div className="mt-1 text-xs text-red-600" title={log.errorMessage}>
                      {log.errorCode || 'Error'}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                  {new Date(log.attemptedAt).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                  {log.deliveredAt ? new Date(log.deliveredAt).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
