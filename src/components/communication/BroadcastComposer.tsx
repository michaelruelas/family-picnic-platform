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
        <label htmlFor="message" className="text-foreground/85 block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message..."
          rows={4}
          disabled={disabled || sending}
          className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg shadow-sm"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          {channel === 'SMS'
            ? `${message.length} characters (SMS limit: 160)`
            : `${message.length} characters`}
        </p>
      </div>

      <div>
        <label className="text-foreground/85 block text-sm font-medium">Channel</label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="channel"
              value="EMAIL"
              checked={channel === 'EMAIL'}
              onChange={() => setChannel('EMAIL')}
              disabled={disabled || sending}
              className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4"
            />
            <span className="text-foreground/85 ml-2 text-sm">Email</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="channel"
              value="SMS"
              checked={channel === 'SMS'}
              onChange={() => setChannel('SMS')}
              disabled={disabled || sending}
              className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4"
            />
            <span className="text-foreground/85 ml-2 text-sm">SMS</span>
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
        <label className="text-foreground/85 block text-sm font-medium">Send Time</label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="sendTime"
              checked={sendImmediately}
              onChange={() => setSendImmediately(true)}
              disabled={disabled || sending}
              className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4"
            />
            <span className="text-foreground/85 ml-2 text-sm">Send immediately</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="sendTime"
              checked={!sendImmediately}
              onChange={() => setSendImmediately(false)}
              disabled={disabled || sending}
              className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4"
            />
            <span className="text-foreground/85 ml-2 text-sm">Schedule for later</span>
          </label>
        </div>
      </div>

      {!sendImmediately && (
        <div>
          <label htmlFor="scheduledAt" className="text-foreground/85 block text-sm font-medium">
            Scheduled Time (8 AM - 9 PM local time)
          </label>
          <input
            type="datetime-local"
            id="scheduledAt"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={disabled || sending}
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg shadow-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Messages outside 8 AM - 9 PM will be deferred to the next available window.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>
      )}

      {success && (
        <div className="bg-sage/15 text-sage rounded-lg p-3 text-sm">
          Message queued successfully!
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={disabled || sending || !isValid}
          className="bg-terracotta hover:bg-terracotta rounded-lg px-6 py-2 font-medium text-white disabled:bg-stone-300"
        >
          {sending ? 'Queuing...' : sendImmediately ? 'Send Message' : 'Schedule Message'}
        </button>
      </div>
    </form>
  );
}
