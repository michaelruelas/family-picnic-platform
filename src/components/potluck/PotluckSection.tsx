'use client';

import { useState } from 'react';
import { trpc } from '~/lib/trpc-client';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS } from '~/lib/constants';

interface PotluckSectionProps {
  eventId: string;
  isPast: boolean;
}

export function PotluckSection({ eventId, isPast }: PotluckSectionProps) {
  const { data, isLoading, refetch } = trpc.potluck.listSlots.useQuery(
    { eventId },
    { enabled: !!eventId },
  );

  const { data: rsvp } = trpc.rsvp.getMyRsvp.useQuery({ eventId }, { enabled: !!eventId });

  const signup = trpc.potluck.signup.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });
  const cancelSignup = trpc.potluck.cancelSignup.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const [pickingSlotId, setPickingSlotId] = useState<string | null>(null);
  const [pickedDish, setPickedDish] = useState('');
  const [pickedServings, setPickedServings] = useState(1);
  const [slotError, setSlotError] = useState<string | null>(null);

  if (isPast) {
    return (
      <div className="bg-secondary mt-4 rounded-2xl p-4 text-sm">
        <p className="text-muted-foreground italic">
          Potluck signups closed when the event passed.
        </p>
      </div>
    );
  }

  if (rsvp && rsvp.status !== 'CONFIRMED') {
    return (
      <div className="bg-secondary mt-4 rounded-2xl p-4 text-sm">
        <p className="text-foreground font-medium">Potluck signups unlock once you RSVP yes.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Mark at least one household member as going above, then come back here to claim a slot.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-secondary mt-4 flex animate-pulse items-center gap-3 rounded-2xl p-4 text-sm">
        <div className="bg-foreground/10 h-3 w-3 rounded-full" />
        <span className="text-muted-foreground">Loading the menu…</span>
      </div>
    );
  }

  const slots = data ?? [];
  if (slots.length === 0) {
    return (
      <div className="bg-secondary mt-4 rounded-2xl p-4 text-sm">
        <p className="text-muted-foreground italic">
          The organizer hasn&apos;t set up any potluck slots for this event yet.
        </p>
      </div>
    );
  }

  const myRsvpId = rsvp?.id;
  const slotsByCategory = slots.reduce(
    (acc, slot) => {
      const cat = slot.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(slot);
      return acc;
    },
    {} as Record<string, typeof slots>,
  );

  const mySignupSlotIds = new Set(
    slots
      .filter((s) => s.signups.some((su) => su.rsvp?.user?.id === rsvp?.userId))
      .map((s) => s.id),
  );

  const handleClaim = async (slotId: string) => {
    if (!myRsvpId) return;
    setSlotError(null);
    if (!pickedDish.trim()) {
      setSlotError('Give your dish a name before claiming the slot.');
      return;
    }
    try {
      await signup.mutateAsync({
        slotId,
        dishName: pickedDish.trim(),
        servings: pickedServings,
        dietaryLabels: [],
      });
      setPickingSlotId(null);
      setPickedDish('');
      setPickedServings(1);
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : 'Could not claim that slot.');
    }
  };

  const handleDrop = async (slotId: string) => {
    setSlotError(null);
    try {
      await cancelSignup.mutateAsync({ slotId });
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : 'Could not drop that slot.');
    }
  };

  return (
    <div className="mt-6 space-y-4" data-testid="rsvp-potluck-section">
      <div>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">The menu</p>
        <h4 className="font-display text-foreground mt-1 text-xl font-medium">Bring a dish</h4>
        <p className="text-muted-foreground mt-1 text-sm">
          Claim an open slot or drop one you can no longer bring.
        </p>
      </div>

      {slotError && (
        <p className="bg-destructive/10 text-destructive ring-destructive/30 rounded-2xl px-4 py-3 text-sm ring-1">
          {slotError}
        </p>
      )}

      {Object.entries(slotsByCategory).map(([category, catSlots]) => (
        <div key={category}>
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span>{POTLUCK_CATEGORY_EMOJIS[category] || '📦'}</span>
            {POTLUCK_CATEGORY_LABELS[category] || category}
          </p>
          <ul className="space-y-2">
            {catSlots.map((slot) => {
              const isFull =
                slot.slotType === 'LIMITED' && slot.signups.length >= (slot.maxSignups ?? 0);
              const isMine = mySignupSlotIds.has(slot.id);
              const isPicking = pickingSlotId === slot.id;
              return (
                <li
                  key={slot.id}
                  className="border-border bg-card/40 rounded-2xl border p-3"
                  data-testid={`potluck-slot-${slot.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">{slot.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {slot.slotType === 'UNLIMITED'
                          ? `${slot.signups.length} signed up · unlimited`
                          : `${slot.signups.length} / ${slot.maxSignups} claimed`}
                      </p>
                    </div>
                    {isMine ? (
                      <button
                        type="button"
                        onClick={() => void handleDrop(slot.id)}
                        disabled={cancelSignup.isPending}
                        className="rounded-pill text-muted-foreground hover:text-destructive px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {cancelSignup.isPending ? 'Dropping…' : 'Drop'}
                      </button>
                    ) : isFull ? (
                      <span className="text-muted-foreground text-xs font-semibold">Full</span>
                    ) : isPicking ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPickingSlotId(null);
                          setPickedDish('');
                          setSlotError(null);
                        }}
                        className="rounded-pill text-muted-foreground hover:text-foreground px-3 py-1.5 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPickingSlotId(slot.id);
                          setPickedDish('');
                          setPickedServings(1);
                          setSlotError(null);
                        }}
                        disabled={!myRsvpId}
                        className="rounded-pill bg-foreground text-background hover:bg-foreground/90 press px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        Claim
                      </button>
                    )}
                  </div>
                  {isPicking && (
                    <div className="bg-secondary/40 mt-3 rounded-xl p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
                        <input
                          type="text"
                          value={pickedDish}
                          onChange={(e) => setPickedDish(e.target.value)}
                          placeholder="Dish name"
                          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground rounded-xl border px-3 py-2 text-sm focus:outline-none"
                        />
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={pickedServings}
                          onChange={(e) =>
                            setPickedServings(Math.max(1, Number(e.target.value) || 1))
                          }
                          placeholder="Servings"
                          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground rounded-xl border px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleClaim(slot.id)}
                        disabled={signup.isPending || !pickedDish.trim()}
                        className="rounded-pill bg-terracotta press mt-3 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#cf6c52] disabled:opacity-50"
                      >
                        {signup.isPending ? 'Claiming…' : 'Confirm dish'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
