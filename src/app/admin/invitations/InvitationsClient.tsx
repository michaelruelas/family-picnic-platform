'use client';

import { useState, useEffect } from 'react';
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

type User = {
  id: string;
  name: string;
  email: string;
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
  const [filteredHouseholds, setFilteredHouseholds] = useState<Household[]>(households);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const filtered = households.filter((h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredHouseholds(filtered);
  }, [searchQuery, households]);

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

  const handleTrackDelivery = async (
    id: string,
    status: 'PENDING' | 'SENT' | 'DELIVERED',
  ) => {
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
          <label htmlFor="event-select" className="block text-sm font-medium text-stone-700">
            Event
          </label>
          <select
            id="event-select"
            value={selectedEvent}
            onChange={(e) => handleEventChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
          >
            <option value="">Select an event...</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({new Date(event.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })})
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <div>
            <label htmlFor="household-search" className="block text-sm font-medium text-stone-700">
              Search Household
            </label>
            <input
              type="text"
              id="household-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by household name..."
              className="mt-1 block w-full rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
        )}
      </div>

      {selectedEvent && searchQuery && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-stone-700">
            Matching Households ({filteredHouseholds.length})
          </h3>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {filteredHouseholds.map((household) => (
              <div
                key={household.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  selectedHousehold === household.id
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-stone-200'
                }`}
              >
                <span className="font-medium text-stone-900">{household.name}</span>
                <button
                  onClick={() => setSelectedHousehold(household.id)}
                  disabled={selectedHousehold === household.id}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-stone-300"
                >
                  {selectedHousehold === household.id ? 'Selected' : 'Select'}
                </button>
              </div>
            ))}
            {filteredHouseholds.length === 0 && (
              <p className="text-center text-stone-500">No households found</p>
            )}
          </div>
          {selectedHousehold && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSendInvitation}
                disabled={sending}
                className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:bg-stone-300"
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-stone-900">Sent Invitations</h2>
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
