'use client';

import { useSession } from 'next-auth/react';
import { trpc } from '~/lib/trpc-client';
import SlotList, { type EventSlot } from '~/components/potluck/SlotList';
import MySlotsSummary from '~/components/potluck/MySlotsSummary';

interface PotluckEditorProps {
  eventId: string;
  hasRsvp: boolean;
  isRsvpConfirmed: boolean;
  /**
   * When true, render only the read-only SlotList. Used by the
   * Potluck tab on the event page before the user has confirmed
   * their RSVP. The full editor flow lives in the standalone
   * /events/[id]/potluck page (readOnly=true) and the RSVP
   * sheet's Potluck tab (readOnly=false).
   */
  readOnly?: boolean;
}

export default function PotluckEditor({
  eventId,
  hasRsvp,
  isRsvpConfirmed,
  readOnly = false,
}: PotluckEditorProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const slotsQuery = trpc.potluck.getSlotsForEvent.useQuery(
    { eventId },
    { enabled: !!eventId, staleTime: 0 },
  );

  const slots: EventSlot[] = (slotsQuery.data ?? []) as EventSlot[];

  if (slotsQuery.isLoading) {
    return (
      <div className="py-6 text-center" aria-busy="true">
        <p className="text-muted-foreground text-sm">Loading the menu…</p>
      </div>
    );
  }

  if (slotsQuery.error) {
    return (
      <div className="bg-destructive/10 text-destructive ring-destructive/30 rounded-sm px-4 py-3 text-sm ring-1">
        We could not load the menu. Try again from the potluck page.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="potluck-editor">
      <SlotList
        eventId={eventId}
        slots={slots}
        userId={userId}
        isRsvpConfirmed={isRsvpConfirmed}
        hasRsvp={hasRsvp}
        readOnly={readOnly}
      />
      <MySlotsSummary
        eventId={eventId}
        hasRsvp={hasRsvp}
        isRsvpConfirmed={isRsvpConfirmed}
        userId={userId}
      />
    </div>
  );
}
