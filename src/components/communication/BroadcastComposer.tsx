'use client';

import { useState } from 'react';
import RecipientSelector from './RecipientSelector';

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

type BroadcastComposerProps = {
  eventId: string;
  households: Household[];
  users: User[];
  onSend: (data: {
    message: string;
    channel: Channel;
    recipientType: RecipientType;
    recipientIds: string[];
    scheduledAt?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
};

export default function BroadcastComposer({
  eventId: _eventId,
  households,
  users,
  onSend,
  disabled = false,
}: BroadcastComposerProps) {
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [recipientType, setRecipientType] = useState<RecipientType>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Message is required');
      return;
    }
    if (!sendImmediately && !scheduledAt) {
      setError('Scheduled time is required');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await onSend({
        message,
        channel,
        recipientType,
        recipientIds: selectedIds,
        scheduledAt: sendImmediately ? undefined : scheduledAt,
      });

      if (result.success) {
        setSuccess(true);
        setMessage('');
        setSelectedIds([]);
        setScheduledAt('');
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  const isValid =
    message.trim().length > 0 &&
    (sendImmediately || (scheduledAt && new Date(scheduledAt) > new Date()));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-stone-700">
          Message
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message..."
          rows={4}
          disabled={disabled || sending}
          className="mt-1 block w-full rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
        />
        <p className="mt-1 text-xs text-stone-500">
          {channel === 'SMS'
            ? `${message.length} characters (SMS limit: 160)`
            : `${message.length} characters`}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Channel</label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="channel"
              value="EMAIL"
              checked={channel === 'EMAIL'}
              onChange={() => setChannel('EMAIL')}
              disabled={disabled || sending}
              className="h-4 w-4 border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="ml-2 text-sm text-stone-700">Email</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="channel"
              value="SMS"
              checked={channel === 'SMS'}
              onChange={() => setChannel('SMS')}
              disabled={disabled || sending}
              className="h-4 w-4 border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="ml-2 text-sm text-stone-700">SMS</span>
          </label>
        </div>
      </div>

      <RecipientSelector
        recipientType={recipientType}
        selectedIds={selectedIds}
        onRecipientTypeChange={setRecipientType}
        onSelectedIdsChange={setSelectedIds}
        households={households}
        users={users}
        disabled={disabled || sending}
      />

      <div>
        <label className="block text-sm font-medium text-stone-700">Send Time</label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="sendTime"
              checked={sendImmediately}
              onChange={() => setSendImmediately(true)}
              disabled={disabled || sending}
              className="h-4 w-4 border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="ml-2 text-sm text-stone-700">Send immediately</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="sendTime"
              checked={!sendImmediately}
              onChange={() => setSendImmediately(false)}
              disabled={disabled || sending}
              className="h-4 w-4 border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="ml-2 text-sm text-stone-700">Schedule for later</span>
          </label>
        </div>
      </div>

      {!sendImmediately && (
        <div>
          <label htmlFor="scheduledAt" className="block text-sm font-medium text-stone-700">
            Scheduled Time (8 AM - 9 PM local time)
          </label>
          <input
            type="datetime-local"
            id="scheduledAt"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={disabled || sending}
            className="mt-1 block w-full rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
          />
          <p className="mt-1 text-xs text-stone-500">
            Messages outside 8 AM - 9 PM will be deferred to the next available window.
          </p>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Message queued successfully!
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={disabled || sending || !isValid}
          className="rounded-lg bg-amber-600 px-6 py-2 font-medium text-white hover:bg-amber-700 disabled:bg-stone-300"
        >
          {sending ? 'Queuing...' : sendImmediately ? 'Send Message' : 'Schedule Message'}
        </button>
      </div>
    </form>
  );
}
