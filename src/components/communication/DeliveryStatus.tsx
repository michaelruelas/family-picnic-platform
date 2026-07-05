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
    QUEUED: { bg: 'bg-sunlight/30', text: 'text-[#a07c2f]', label: 'Queued' },
    SENT: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
    DELIVERED: { bg: 'bg-sage/20', text: 'text-sage', label: 'Delivered' },
    FAILED: { bg: 'bg-destructive/15', text: 'text-destructive', label: 'Failed' },
    UNSUBSCRIBED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Unsubscribed' },
  };

  const { bg, text, label } = config[status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: status,
  };

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
        <div className="border-terracotta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="text-muted-foreground ml-2">Loading delivery status...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-secondary rounded-xl p-8 text-center">
        <div className="text-4xl">📭</div>
        <h3 className="text-foreground mt-2 text-lg font-medium">No Messages Sent</h3>
        <p className="text-muted-foreground mt-1">
          Send a broadcast message to see delivery status here.
        </p>
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
        <div className="bg-secondary rounded-lg p-3">
          <div className="text-foreground text-2xl font-bold">{summary.total}</div>
          <div className="text-muted-foreground">Total</div>
        </div>
        <div className="bg-sunlight/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-[#a07c2f]">{summary.queued}</div>
          <div className="text-yellow-600">Queued</div>
        </div>
        <div className="rounded-lg bg-blue-100 p-3">
          <div className="text-2xl font-bold text-blue-700">{summary.sent}</div>
          <div className="text-blue-600">Sent</div>
        </div>
        <div className="bg-sage/20 rounded-lg p-3">
          <div className="text-sage text-2xl font-bold">{summary.delivered}</div>
          <div className="text-sage">Delivered</div>
        </div>
        <div className="bg-destructive/15 rounded-lg p-3">
          <div className="text-destructive text-2xl font-bold">{summary.failed}</div>
          <div className="text-destructive">Failed</div>
        </div>
        <div className="rounded-lg bg-gray-100 p-3">
          <div className="text-2xl font-bold text-gray-700">{summary.unsubscribed}</div>
          <div className="text-gray-600">Unsubscribed</div>
        </div>
      </div>

      <div className="border-border overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-secondary/60">
            <tr>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Recipient
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Channel
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Status
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Attempted
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Delivered
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-secondary/60">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-foreground font-medium">
                    {log.recipient?.name || 'Unknown'}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {log.recipient?.email || log.recipientUserId}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="bg-secondary text-foreground/85 inline-flex rounded-full px-2 py-1 text-xs font-medium">
                    {log.channel}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={log.status} />
                  {log.errorMessage && (
                    <div className="text-destructive mt-1 text-xs" title={log.errorMessage}>
                      {log.errorCode || 'Error'}
                    </div>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
                  {new Date(log.attemptedAt).toLocaleString()}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
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
