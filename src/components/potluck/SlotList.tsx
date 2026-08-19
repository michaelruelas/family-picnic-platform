'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Modal, Spinner } from '~/components/ui';
import { useMyPotluckSignups, usePotluckSignupMutation, type MyPotluckSignup } from '~/hooks';
import {
  POTLUCK_CATEGORY_EMOJIS,
  POTLUCK_CATEGORY_LABELS,
  POTLUCK_CATEGORY_ORDER,
  slotDisplayName,
} from '~/lib/constants';
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
      // FPP-127: the household name is the primary identity handle
      // on a potluck claim. The user name remains for the
      // "is mine?" affordance; the UI reads householdName first.
      householdName: string | null;
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
   * the editor from the Potluck tab inside the RSVP sheet. The
   * Potluck tab uses the editable default.
   */
  readOnly?: boolean;
}

const DISPLAY_CATEGORY_ORDER = POTLUCK_CATEGORY_ORDER; // MAIN -> SIDE -> DESSERT -> DRINK -> OTHER

function categoryOrderKey(category: string): number {
  const idx = (DISPLAY_CATEGORY_ORDER as readonly string[]).indexOf(category);
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

/**
 * Multi-claim: returns every signup row the caller owns on this slot,
 * not just the first one. A household can bring several distinct
 * items in the same category (e.g. "Other: Cups" + "Other: Napkins"),
 * each backed by its own PotluckSignup row.
 */
function findMySignups(slot: EventSlot, mySignups: MyPotluckSignup[]): MyPotluckSignup[] {
  return mySignups.filter((s) => s.slotId === slot.id);
}

interface SignupRow {
  id: string;
  isMine: boolean;
  mySignup?: MyPotluckSignup;
  dishName: string;
  householdLabel: string | null;
}

/**
 * Build the list of signup rows shown on a dish card. The slot's
 * public signups and the caller's own mySignups are unioned so the
 * user's rows render even when the slot's public signups are stale
 * (e.g. just-claimed, not yet refetched). The mySignup entries carry
 * less data (no rsvp.householdName) so the household cell falls back
 * to "You".
 *
 * Auth gate: anonymous viewers (userId=null) never see household or
 * user names — those are personal data; dish names stay visible.
 */
function buildSignupRows(
  slot: EventSlot,
  mySignupsOnSlot: MyPotluckSignup[],
  userId: string | null,
): SignupRow[] {
  const seen = new Set<string>();
  const rows: SignupRow[] = [];
  for (const s of slot.signups) {
    const mySignup = mySignupsOnSlot.find((m) => m.id === s.id);
    // Auth gate: anonymous viewers (userId=null) never see household
    // or user names — those are personal data. The chain below keeps
    // the conditional shape so the structural privacy test can assert
    // the gate exists.
    const householdLabel = !userId ? '' : (s.rsvp.householdName ?? s.rsvp.user?.name ?? 'Guest');
    rows.push({
      id: s.id,
      isMine: !!mySignup,
      mySignup,
      dishName: s.dishName,
      householdLabel,
    });
    seen.add(s.id);
  }
  for (const m of mySignupsOnSlot) {
    if (seen.has(m.id)) continue;
    rows.push({
      id: m.id,
      isMine: true,
      mySignup: m,
      dishName: m.dishName,
      householdLabel: userId ? 'You' : null,
    });
  }
  // Sort by dish name ascending (A → Z) so the menu reads top-to-bottom.
  rows.sort((a, b) => (a.dishName || '').localeCompare(b.dishName || ''));
  return rows;
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

  // The claim modal targets either an existing signup (edit) or a
  // fresh claim on a slot. `editSignupId` is null for new claims.
  const [claimSlotId, setClaimSlotId] = useState<string | null>(null);
  const [editSignupId, setEditSignupId] = useState<string | null>(null);
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

  const claimSlot = claimSlotId ? (slots.find((s) => s.id === claimSlotId) ?? null) : null;
  const mySignupsOnClaimSlot = claimSlot ? findMySignups(claimSlot, mySignups) : [];
  const claimEditSignup = editSignupId
    ? (mySignupsOnClaimSlot.find((s) => s.id === editSignupId) ?? null)
    : null;
  const claimIsEdit = !!claimEditSignup;
  const claimIsFull = claimSlot
    ? isSlotFull(claimSlot) && mySignupsOnClaimSlot.length === 0
    : false;

  const openNewClaim = (slotId: string) => {
    setError(null);
    setEditSignupId(null);
    setDishName('');
    setClaimSlotId(slotId);
  };

  const openEditClaim = (signupRow: MyPotluckSignup) => {
    setError(null);
    setEditSignupId(signupRow.id);
    setDishName(signupRow.dishName);
    setClaimSlotId(signupRow.slotId);
  };

  const closeClaim = () => {
    setClaimSlotId(null);
    setEditSignupId(null);
    setDishName('');
    setError(null);
  };

  const submitClaim = async () => {
    if (!claimSlot) return;
    const trimmed = dishName.trim();
    setError(null);
    try {
      if (claimEditSignup) {
        await updateSignup.mutateAsync({
          signupId: claimEditSignup.id,
          dishName: trimmed,
          servings: claimEditSignup.servings,
          dietaryLabels: claimEditSignup.dietaryLabels,
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

  const handleDrop = async (signupId: string) => {
    try {
      await cancelSignup.mutateAsync({ signupId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not drop that dish.');
    }
  };

  if (slots.length === 0) {
    return (
      <div className="bg-sunlight/20 ring-sunlight/40 rounded-sm p-12 text-center ring-1">
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
      {error && (
        <div className="bg-destructive/10 text-destructive ring-destructive/30 mb-4 rounded-sm px-4 py-3 text-sm ring-1">
          {error}
        </div>
      )}

      <div className="space-y-10">
        {groupedSlots.map(({ category, slots: categorySlots }) => (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <div className="flex items-center gap-3">
              <span
                className="bg-card ring-border/60 inline-flex h-10 w-10 items-center justify-center rounded-sm text-xl ring-1"
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
            </div>

            <ul className="mt-5 space-y-4">
              {categorySlots.map((slot) => {
                const full = isSlotFull(slot);
                const mySignupsOnSlot = findMySignups(slot, mySignups);
                const hasMine = mySignupsOnSlot.length > 0;
                const rows = buildSignupRows(slot, mySignupsOnSlot, userId);
                const signupCount = rows.length;
                // The new-claim button is disabled only when the slot is
                // full. Existing signups on this slot do not block a
                // multi-claim — the household can bring several distinct
                // items in the same category.
                const newClaimDisabled = !userId || !isRsvpConfirmed || (full && !hasMine);
                return (
                  <li
                    key={slot.id}
                    className="bg-card shadow-card ring-border/60 rounded-sm p-5 ring-1 sm:p-6"
                    data-testid={`potluck-slot-${slot.id}`}
                    data-slot-mine={hasMine ? 'true' : 'false'}
                    data-slot-full={full ? 'true' : 'false'}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-foreground min-w-0 flex-1 truncate font-semibold">
                        {slotDisplayName(slot)}
                      </p>
                      <div className="shrink-0 text-right">
                        <span className="bg-sage/20 text-sage inline-flex items-baseline gap-0.5 rounded-sm px-2.5 py-1 font-semibold tabular-nums">
                          <span>{signupCount}</span>
                          {slot.slotType === 'LIMITED' && slot.maxSignups !== null && (
                            <span className="text-xs font-medium opacity-70">
                              / {slot.maxSignups}
                            </span>
                          )}
                        </span>
                        <p className="text-muted-foreground mt-1 text-[11px] font-medium tracking-wide uppercase">
                          {signupCount === 1 ? 'signup' : 'signups'}
                          {full ? ' · full' : ''}
                        </p>
                      </div>
                    </div>

                    {rows.length > 0 && (
                      <>
                        {/* Thin separator between the header and the
                          signup list — gives the card a clear "title
                          row → content row" rhythm without adding a
                          heavy outer border. */}
                        <hr className="border-border/60 mt-4 border-t" />
                        <div className="mt-1">
                          <table
                            className="w-full text-sm"
                            data-testid={`potluck-signups-table-${slot.id}`}
                          >
                            <tbody className="divide-border/60 divide-y">
                              {rows.map((row, idx) => {
                                // Alternating rows stay subtle so the
                                // "yours" highlight always wins on
                                // contrast. YOURS rows skip the stripe
                                // and get their own sage background +
                                // left edge accent so the eye locks on
                                // them regardless of row position.
                                const rowClasses = row.isMine
                                  ? 'bg-sage/25 border-l-4 border-l-sage'
                                  : idx % 2 === 1
                                    ? 'bg-secondary/20'
                                    : '';
                                return (
                                  <tr
                                    key={row.id}
                                    data-testid={
                                      row.isMine ? `potluck-my-signup-${row.id}` : undefined
                                    }
                                    className={rowClasses}
                                  >
                                    <td className="text-foreground py-2.5 pr-4 pl-3 font-medium">
                                      <span className="flex flex-wrap items-center gap-2">
                                        <span>{row.dishName || '(no name)'}</span>
                                        {row.isMine && (
                                          <span
                                            className="bg-sage inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
                                            data-testid="yours-badge"
                                          >
                                            <span aria-hidden="true">★</span>
                                            You
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                    <td className="text-muted-foreground py-2.5 pr-4 text-right align-middle">
                                      {row.householdLabel ?? (
                                        <span className="text-muted-foreground/40 font-normal">
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-right align-middle">
                                      {!readOnly && row.isMine && row.mySignup ? (
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => openEditClaim(row.mySignup!)}
                                            disabled={!isRsvpConfirmed}
                                            className="text-foreground/80 hover:text-foreground rounded-sm px-2 py-0.5 text-xs font-semibold underline-offset-4 hover:underline disabled:opacity-50"
                                            data-testid={`potluck-edit-signup-${row.mySignup!.id}`}
                                            aria-label={`Edit ${row.mySignup!.dishName || 'dish'}`}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDrop(row.mySignup!.id)}
                                            disabled={cancelSignup.isPending}
                                            className="text-muted-foreground hover:text-destructive rounded-sm px-2 py-0.5 text-xs font-semibold underline-offset-4 hover:underline disabled:opacity-50"
                                            data-testid={`potluck-drop-signup-${row.mySignup!.id}`}
                                            aria-label={`Drop ${row.mySignup!.dishName || 'dish'}`}
                                          >
                                            Drop
                                          </button>
                                        </div>
                                      ) : null}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {!readOnly && (
                      <div className="mt-4 flex gap-2">
                        {!hasMine ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openNewClaim(slot.id)}
                            disabled={newClaimDisabled}
                            data-testid={`potluck-claim-${slot.id}`}
                          >
                            {full ? 'Full' : 'Claim this dish'}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openNewClaim(slot.id)}
                            disabled={newClaimDisabled}
                            data-testid={`potluck-claim-another-${slot.id}`}
                          >
                            {full ? 'Signups full' : 'Claim another dish'}
                          </Button>
                        )}
                      </div>
                    )}
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
            <div className="bg-secondary/60 rounded-sm px-4 py-3">
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
                placeholder="e.g. Mac and cheese (optional)"
                maxLength={80}
                className="mt-3"
                data-testid="potluck-claim-dish-input"
              />
            </div>
            {error && (
              <p
                className="bg-destructive/10 text-destructive ring-destructive/30 rounded-sm px-4 py-3 text-sm ring-1"
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
                  'Add to my signups'
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
