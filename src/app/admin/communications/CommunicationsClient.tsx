'use client';

import { useState } from 'react';
import BroadcastComposer from '~/components/communication/BroadcastComposer';
import DeliveryStatus from '~/components/communication/DeliveryStatus';

type Channel = 'EMAIL' | 'SMS';
type RecipientType = 'ALL' | 'HOUSEHOLD' | 'INDIVIDUAL' | 'NOT_RESPONDED';

type Household = {
  id: string;
  name: string;
};

type User = {
  id: string;
  name: string;
  email: string;
};

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

type AdminCommunicationsClientProps = {
  eventId: string;
  households: Household[];
  users: User[];
  initialLogs: DeliveryLog[];
};

export default function AdminCommunicationsClient({
  eventId,
  households,
  users,
  initialLogs,
}: AdminCommunicationsClientProps) {
  const [activeTab, setActiveTab] = useState<'compose' | 'status'>('compose');
  const [logs, setLogs] = useState<DeliveryLog[]>(initialLogs);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleSend = async (data: {
    message: string;
    channel: Channel;
    recipientType: RecipientType;
    recipientIds: string[];
    scheduledAt?: string;
  }) => {
    const response = await fetch('/api/admin/communications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, ...data }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Failed to send message' };
    }

    const result = await response.json();
    if (result.success) {
      setActiveTab('status');
      await fetchLogs();
    }
    return result;
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await fetch(`/api/admin/communications/status?eventId=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-border flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('compose')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === 'compose'
              ? 'border-terracotta text-terracotta'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          Compose
        </button>
        <button
          onClick={() => {
            setActiveTab('status');
            fetchLogs();
          }}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === 'status'
              ? 'border-terracotta text-terracotta'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          Delivery Status
        </button>
      </div>

      {activeTab === 'compose' ? (
        <div className="border-border rounded-xl border bg-white p-6">
          <h2 className="text-foreground mb-4 text-lg font-semibold">New Broadcast Message</h2>
          <BroadcastComposer
            eventId={eventId}
            households={households}
            users={users}
            onSend={handleSend}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-lg font-semibold">Delivery Status</h2>
            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="bg-secondary text-foreground/85 hover:bg-secondary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          <DeliveryStatus logs={logs} loading={loadingLogs} />
        </div>
      )}
    </div>
  );
}
