'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import InvitationTable from '~/components/invitation/InvitationTable';
import CsvUploader from '~/components/admin/CsvUploader';

type Event = {
  id: string;
  name: string;
  date: string | Date;
};

type Household = {
  id: string;
  name: string;
};

type InvitationWithRelations = {
  id: string;
  eventId: string;
  householdId: string | null;
  userId: string | null;
  status: string;
  token: string | null;
  expiresAt: Date | string | null;
  sentAt: Date | string | null;
  createdAt: Date | string;
  household: { id: string; name: string } | null;
  user: { id: string; name: string; email: string } | null;
};

export default function AdminInvitationsClient({
  events,
  households,
  initialInvitations,
  selectedEventId,
}: {
  events: Event[];
  households: Household[];
  initialInvitations: InvitationWithRelations[];
  selectedEventId: string | null;
}) {
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState<string>(selectedEventId || '');
  const [invitations, setInvitations] = useState<InvitationWithRelations[]>(initialInvitations);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<string>('');
  const [sending, setSending] = useState(false);

  const filteredHouseholds = useMemo(
    () =>
      searchQuery
        ? households.filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : households,
    [searchQuery, households],
  );

  const handleEventChange = (eventId: string) => {
    setSelectedEvent(eventId);
    router.push(`/admin/invitations?event=${eventId}`);
  };

  const handleResend = async (id: string) => {
    await fetch('/api/admin/invitations/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (selectedEvent) {
      const res = await fetch(`/api/admin/invitations?event=${selectedEvent}`);
      const data = await res.json();
      setInvitations(data);
    }
  };

  const handleTrackDelivery = async (id: string, status: 'PENDING' | 'SENT' | 'DELIVERED') => {
    await fetch('/api/admin/invitations/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (selectedEvent) {
      const res = await fetch(`/api/admin/invitations?event=${selectedEvent}`);
      const data = await res.json();
      setInvitations(data);
    }
  };

  const handleSendInvitation = async () => {
    if (!selectedEvent || !selectedHousehold) return;
    setSending(true);
    try {
      await fetch('/api/admin/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent, householdId: selectedHousehold }),
      });
      const res = await fetch(`/api/admin/invitations?event=${selectedEvent}`);
      const data = await res.json();
      setInvitations(data);
      setSelectedHousehold('');
      setSearchQuery('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="event-select" className="text-foreground/85 block text-sm font-medium">
            Event
          </label>
          <select
            id="event-select"
            value={selectedEvent}
            onChange={(e) => handleEventChange(e.target.value)}
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg shadow-sm"
          >
            <option value="">Select an event...</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} (
                {new Date(event.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                )
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <div>
            <label
              htmlFor="household-search"
              className="text-foreground/85 block text-sm font-medium"
            >
              Search Household
            </label>
            <input
              type="text"
              id="household-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by household name..."
              className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg shadow-sm"
            />
          </div>
        )}
      </div>

      {selectedEvent && searchQuery && (
        <div className="border-border rounded-xl border bg-white p-4">
          <h3 className="text-foreground/85 mb-3 text-sm font-medium">
            Matching Households ({filteredHouseholds.length})
          </h3>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {filteredHouseholds.map((household) => (
              <div
                key={household.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  selectedHousehold === household.id
                    ? 'border-terracotta bg-sunlight/20'
                    : 'border-border'
                }`}
              >
                <span className="text-foreground font-medium">{household.name}</span>
                <button
                  onClick={() => setSelectedHousehold(household.id)}
                  disabled={selectedHousehold === household.id}
                  className="bg-terracotta hover:bg-terracotta rounded-lg px-3 py-1 text-sm font-medium text-white disabled:bg-stone-300"
                >
                  {selectedHousehold === household.id ? 'Selected' : 'Select'}
                </button>
              </div>
            ))}
            {filteredHouseholds.length === 0 && (
              <p className="text-muted-foreground text-center">No households found</p>
            )}
          </div>
          {selectedHousehold && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSendInvitation}
                disabled={sending}
                className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 font-medium text-white disabled:bg-stone-300"
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <div>
          <h2 className="text-foreground mb-4 text-lg font-semibold">Sent Invitations</h2>
          <InvitationTable
            invitations={invitations}
            onResend={handleResend}
            onTrackDelivery={handleTrackDelivery}
          />
        </div>
      )}

      {selectedEvent && (
        <CsvUploader
          eventId={selectedEvent}
          onImportComplete={async () => {
            const res = await fetch(`/api/admin/invitations?event=${selectedEvent}`);
            const data = await res.json();
            setInvitations(data);
          }}
        />
      )}
    </div>
  );
}
