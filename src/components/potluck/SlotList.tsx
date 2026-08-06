'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Modal, Spinner } from '~/components/ui';
import { useMyPotluckSignups, usePotluckSignupMutation, type MyPotluckSignup } from '~/hooks';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS, slotDisplayName } from '~/lib/constants';
import { SlotType } from '~/lib/generated/enums';

export interface EventSlot {
  id: string;
  // FPP-54: name is optional. A null/empty name renders as a
  // category-only slot (e.g. "A dessert (any)") so users know the
  // category without seeing a pre-baked dish name.
  name: string | null;
  category: keyof typeof POTLUCK_CATEGORY_LABELS | string;
  slotType: keyof typeof SlotType | string;
  maxSignups: number | null;
  currentSignups: number;
  signups: Array<{
    id: string;
    dishName: string;
    servings: number;
    dietaryLabels: string[];
    rsvp: {
      userId: string;
      user: { id: string; name: string | null } | null;
    };
  }>;
}

interface SlotListProps {
  eventId: string;
  slots: EventSlot[];
  userId: string | null;
  isRsvpConfirmed: boolean;
  hasRsvp: boolean;
  /**
   * When true, hide all claim / edit / drop affordances. The
   * standalone /events/[id]/potluck page sets this so users reach
   * the editor from the Dishes tab inside the RSVP sheet. The
   * Dishes tab uses the editable default.
   */
  readOnly?: boolean;
}

const DISPLAY_CATEGORY_ORDER = ['MAIN', 'SIDE', 'DESSERT', 'DRINK', 'OTHER'] as const;

function categoryOrderKey(category: string): number {
  const idx = DISPLAY_CATEGORY_ORDER.indexOf(category as (typeof DISPLAY_CATEGORY_ORDER)[number]);
  return idx === -1 ? DISPLAY_CATEGORY_ORDER.length : idx;
}

function remainingCapacity(slot: EventSlot): number | null {
  if (slot.slotType !== 'LIMITED' || slot.maxSignups === null) return null;
  return Math.max(0, slot.maxSignups - slot.currentSignups);
}

function isSlotFull(slot: EventSlot): boolean {
  const remaining = remainingCapacity(slot);
  return remaining !== null && remaining <= 0;
}

function findMySignup(slot: EventSlot, mySignups: MyPotluckSignup[]): MyPotluckSignup | null {
  return mySignups.find((s) => s.slotId === slot.id) ?? null;
}

export default function SlotList({
  eventId,
  slots,
  userId,
  isRsvpConfirmed,
  hasRsvp,
  readOnly = false,
}: SlotListProps) {
  const { signups: mySignups } = useMyPotluckSignups({
    eventId,
    enabled: !!userId && hasRsvp,
  });
  const { signup, updateSignup, cancelSignup } = usePotluckSignupMutation();

  const [claimSlotId, setClaimSlotId] = useState<string | null>(null);
  const [dishName, setDishName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, EventSlot[]>();
    for (const slot of slots) {
      const list = groups.get(slot.category) ?? [];
      list.push(slot);
      groups.set(slot.category, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => categoryOrderKey(a) - categoryOrderKey(b))
      .map(([category, list]) => ({ category, slots: list }));
  }, [slots]);

  const claimedSlotIds = useMemo(() => new Set(mySignups.map((s) => s.slotId)), [mySignups]);

  const claimSlot = claimSlotId ? (slots.find((s) => s.id === claimSlotId) ?? null) : null;
  const claimMySignup = claimSlot ? findMySignup(claimSlot, mySignups) : null;
  const claimIsEdit = !!claimMySignup;
  const claimIsFull = claimSlot ? isSlotFull(claimSlot) && !claimIsEdit : false;

  const openClaim = (slotId: string) => {
    setError(null);
    const slot = slots.find((s) => s.id === slotId);
    const existing = slot ? findMySignup(slot, mySignups) : null;
    setDishName(existing?.dishName ?? '');
    setClaimSlotId(slotId);
  };

  const closeClaim = () => {
    setClaimSlotId(null);
    setDishName('');
    setError(null);
  };

  const submitClaim = async () => {
    if (!claimSlot) return;
    const trimmed = dishName.trim();
    if (trimmed === '') {
      setError('Tell us what you are bringing so others can coordinate.');
      return;
    }
    setError(null);
    try {
      if (claimMySignup) {
        await updateSignup.mutateAsync({
          slotId: claimSlot.id,
          dishName: trimmed,
          servings: claimMySignup.servings,
          dietaryLabels: claimMySignup.dietaryLabels,
        });
      } else {
        await signup.mutateAsync({
          slotId: claimSlot.id,
          dishName: trimmed,
          servings: 1,
          dietaryLabels: [],
        });
      }
      closeClaim();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your dish.');
    }
  };

  const handleDrop = async (slotId: string) => {
    try {
      await cancelSignup.mutateAsync({ slotId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not drop that dish.');
    }
  };

  if (slots.length === 0) {
    return (
      <div className="bg-sunlight/20 ring-sunlight/40 rounded-3xl p-12 text-center ring-1">
        <div className="text-5xl">🍽️</div>
        <h3 className="font-display text-foreground mt-4 text-2xl font-semibold">
          The menu is still being planned
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          The organizer has not set up potluck categories for this event yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <>
      {!userId ? (
        <div className="bg-sunlight/20 ring-sunlight/40 mb-6 rounded-2xl px-5 py-4 text-sm ring-1">
          <p className="text-foreground">
            <span className="font-semibold">Sign in</span> to claim a dish. You can bring one thing
            from every open category.
          </p>
        </div>
      ) : !hasRsvp ? (
        <div className="bg-sunlight/20 ring-sunlight/40 mb-6 rounded-2xl px-5 py-4 text-sm ring-1">
          <p className="text-foreground">
            <span className="font-semibold">RSVP first.</span> Once you have confirmed attendance
            you can claim potluck dishes.
          </p>
        </div>
      ) : !isRsvpConfirmed ? (
        <div className="bg-secondary mb-6 rounded-2xl px-5 py-4 text-sm">
          <p className="text-foreground/85">
            Your RSVP is not confirmed. Update it on the event page to claim dishes.
          </p>
        </div>
      ) : null}

      {error && (
        <div className="bg-destructive/10 text-destructive ring-destructive/30 mb-4 rounded-2xl px-4 py-3 text-sm ring-1">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {groupedSlots.map(({ category, slots: categorySlots }) => (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <div className="flex items-center gap-3">
              <span
                className="bg-card ring-border/60 inline-flex h-10 w-10 items-center justify-center rounded-full text-xl ring-1"
                aria-hidden="true"
              >
                {POTLUCK_CATEGORY_EMOJIS[category] ?? '🍴'}
              </span>
              <h3
                id={`cat-${category}`}
                className="font-display text-foreground text-2xl font-medium"
              >
                {POTLUCK_CATEGORY_LABELS[category] ?? category}
              </h3>
              <span className="text-muted-foreground ml-auto text-sm">
                {categorySlots.length} {categorySlots.length === 1 ? 'slot' : 'slots'}
              </span>
            </div>

            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {categorySlots.map((slot) => {
                const full = isSlotFull(slot);
                const remaining = remainingCapacity(slot);
                const isMine = claimedSlotIds.has(slot.id);
                const disabled = !userId || !isRsvpConfirmed || (full && !isMine);
                return (
                  <li
                    key={slot.id}
                    className="bg-card shadow-card ring-border/60 rounded-2xl p-5 ring-1"
                    data-testid={`potluck-slot-${slot.id}`}
                    data-slot-mine={isMine ? 'true' : 'false'}
                    data-slot-full={full ? 'true' : 'false'}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-semibold">
                          {slotDisplayName(slot)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {slot.slotType === 'UNLIMITED'
                            ? `${slot.currentSignups} ${
                                slot.currentSignups === 1 ? 'signup' : 'signups'
                              }`
                            : `${slot.currentSignups}/${slot.maxSignups} filled${
                                remaining !== null && !full
                                  ? ` · ${remaining} left`
                                  : full
                                    ? ' · full'
                                    : ''
                              }`}
                        </p>
                      </div>
                      {isMine ? (
                        <span
                          className="bg-sage/20 text-sage rounded-pill inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold"
                          data-testid="yours-badge"
                        >
                          <span>✓</span> Yours
                        </span>
                      ) : null}
                    </div>

                    {slot.signups.length > 0 && (
                      <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
                        {slot.signups.slice(0, 3).map((s) => (
                          <li key={s.id} className="truncate">
                            <span className="text-foreground/80 font-medium">{s.dishName}</span>
                            {s.rsvp.user?.name ? ` · ${s.rsvp.user.name}` : ''}
                          </li>
                        ))}
                        {slot.signups.length > 3 && (
                          <li className="text-muted-foreground/80">
                            +{slot.signups.length - 3} more
                          </li>
                        )}
                      </ul>
                    )}

                    <div className="mt-4 flex gap-2">
                      {readOnly ? null : isMine ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openClaim(slot.id)}
                            disabled={!isRsvpConfirmed}
                            data-testid={`potluck-edit-${slot.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDrop(slot.id)}
                            disabled={cancelSignup.isPending}
                            data-testid={`potluck-drop-${slot.id}`}
                          >
                            {cancelSignup.isPending ? 'Dropping…' : 'Drop'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openClaim(slot.id)}
                          disabled={disabled}
                          data-testid={`potluck-claim-${slot.id}`}
                        >
                          {full ? 'Full' : 'Claim this dish'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <Modal
        isOpen={claimSlotId !== null}
        onClose={closeClaim}
        size="md"
        variant="bottom-sheet"
        title={claimIsEdit ? 'Update your dish' : 'Bring a dish'}
      >
        {claimSlot ? (
          <div className="space-y-4">
            <div className="bg-secondary/60 rounded-2xl px-4 py-3">
              <p className="text-foreground font-semibold">{slotDisplayName(claimSlot)}</p>
              <p className="text-muted-foreground text-xs">
                {POTLUCK_CATEGORY_LABELS[claimSlot.category] ?? claimSlot.category}
                {claimIsFull ? ' · full' : ''}
              </p>
            </div>
            <div>
              <label
                htmlFor="potluck-claim-dish"
                className="text-foreground block text-sm font-medium"
              >
                What are you bringing?
              </label>
              <p className="text-muted-foreground mt-1 text-xs">
                Short name, like &ldquo;Mac and cheese&rdquo; or &ldquo;Brownies.&rdquo;
              </p>
              <Input
                id="potluck-claim-dish"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder="e.g. Mac and cheese"
                maxLength={80}
                className="mt-3"
                data-testid="potluck-claim-dish-input"
              />
            </div>
            {error && (
              <p
                className="bg-destructive/10 text-destructive ring-destructive/30 rounded-2xl px-4 py-3 text-sm ring-1"
                data-testid="potluck-claim-error"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={submitClaim}
                disabled={signup.isPending || updateSignup.isPending}
                data-testid="potluck-claim-submit"
              >
                {signup.isPending || updateSignup.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" /> Saving…
                  </span>
                ) : claimIsEdit ? (
                  'Save changes'
                ) : (
                  'Add to my slots'
                )}
              </Button>
              <Button variant="ghost" onClick={closeClaim}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
