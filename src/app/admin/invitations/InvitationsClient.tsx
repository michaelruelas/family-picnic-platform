'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '~/components/ui/Toast';
import InvitationsTable, { type AdminInvitationRow } from '~/components/admin/InvitationsTable';
import CsvUploader from '~/components/admin/CsvUploader';
import { formatDate } from '~/lib/format-date';

type Event = {
  id: string;
  name: string;
  date: string | Date;
};

type Household = {
  id: string;
  name: string;
};

type SerializedInvitation = {
  id: string;
  eventId: string;
  householdId: string | null;
  userId: string | null;
  status: AdminInvitationRow['status'];
  token: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  createdAt: string;
  household: { id: string; name: string } | null;
  user: { id: string; name: string; email: string } | null;
};

function serialize(row: {
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
}): AdminInvitationRow {
  return {
    id: row.id,
    status: row.status as AdminInvitationRow['status'],
    token: row.token,
    expiresAt: row.expiresAt
      ? typeof row.expiresAt === 'string'
        ? row.expiresAt
        : row.expiresAt.toISOString()
      : null,
    sentAt: row.sentAt
      ? typeof row.sentAt === 'string'
        ? row.sentAt
        : row.sentAt.toISOString()
      : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : row.createdAt.toISOString(),
    household: row.household,
    user: row.user,
  };
}

export default function AdminInvitationsClient({
  events,
  households,
  initialInvitations,
  selectedEventId,
}: {
  events: Event[];
  households: Household[];
  initialInvitations: SerializedInvitation[];
  selectedEventId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedEvent, setSelectedEvent] = useState<string>(selectedEventId || '');
  const [invitations, setInvitations] = useState<AdminInvitationRow[]>(
    initialInvitations.map(serialize),
  );
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

  function handleEventChange(eventId: string) {
    setSelectedEvent(eventId);
    router.push(`/admin/invitations?event=${eventId}`);
  }

  async function handleSendInvitation() {
    if (!selectedEvent || !selectedHousehold) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent, householdId: selectedHousehold }),
      });
      if (!res.ok) {
        const text = await res.text();
        toast.addToast('error', text || 'Failed to send invitation');
        return;
      }
      toast.addToast('success', 'Invitation sent');
      // Refresh invitations list
      const listRes = await fetch(`/api/admin/invitations?event=${selectedEvent}`);
      if (listRes.ok) {
        const data = await listRes.json();
        setInvitations(data.map(serialize));
      }
      setSelectedHousehold('');
      setSearchQuery('');
    } finally {
      setSending(false);
    }
  }

  async function refreshInvitations(eventId: string) {
    const res = await fetch(`/api/admin/invitations?event=${eventId}`);
    if (!res.ok) return;
    const data = await res.json();
    setInvitations(data.map(serialize));
  }

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
            <option value="">Select an event…</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({formatDate(event.date, 'date')})
              </option>
            ))}
          </select>
        </div>

        {selectedEvent ? (
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
              placeholder="Search by household name…"
              className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg shadow-sm"
            />
          </div>
        ) : null}
      </div>

      {selectedEvent && searchQuery ? (
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
                  type="button"
                  onClick={() => setSelectedHousehold(household.id)}
                  disabled={selectedHousehold === household.id}
                  className="bg-terracotta hover:bg-terracotta rounded-lg px-3 py-1 text-sm font-medium text-white disabled:bg-stone-300"
                >
                  {selectedHousehold === household.id ? 'Selected' : 'Select'}
                </button>
              </div>
            ))}
            {filteredHouseholds.length === 0 ? (
              <p className="text-muted-foreground text-center">No households found</p>
            ) : null}
          </div>
          {selectedHousehold ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSendInvitation()}
                disabled={sending}
                className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 font-medium text-white disabled:bg-stone-300"
              >
                {sending ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="space-y-6">
          <h2 className="text-foreground text-lg font-semibold">Sent Invitations</h2>
          <InvitationsTable initialInvitations={invitations} />
          <CsvUploader
            eventId={selectedEvent}
            onImportComplete={async () => {
              await refreshInvitations(selectedEvent);
            }}
          />
        </div>
      ) : (
        <div className="bg-secondary rounded-xl p-12 text-center">
          <div className="text-5xl">📨</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">Select an event</h2>
          <p className="text-muted-foreground mt-2">
            Pick an event from the dropdown above to view and manage its invitations.
          </p>
        </div>
      )}
    </div>
  );
}
