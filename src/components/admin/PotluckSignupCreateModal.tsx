'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '~/components/ui/Modal';
import { useToast } from '~/components/ui/Toast';
import { trpc } from '~/lib/trpc-client';
import { POTLUCK_CATEGORY_LABELS } from '~/lib/constants';

export interface AdminPotluckSlotOption {
  id: string;
  name: string | null;
  category: string;
  slotType: 'LIMITED' | 'UNLIMITED';
  maxSignups: number | null;
  currentSignups: number;
}

export interface AdminPotluckHouseholdOption {
  rsvpId: string;
  userId: string;
  userName: string;
  userEmail: string;
  householdId: string | null;
  householdName: string;
  rsvpStatus: string;
}

interface PotluckSignupCreateModalProps {
  eventId: string;
  eventName: string;
  slots: AdminPotluckSlotOption[];
  households: AdminPotluckHouseholdOption[];
  onClose: () => void;
}

export default function PotluckSignupCreateModal({
  eventId,
  eventName,
  slots,
  households,
  onClose,
}: PotluckSignupCreateModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [slotId, setSlotId] = useState(slots[0]?.id ?? '');
  const [rsvpId, setRsvpId] = useState(households[0]?.rsvpId ?? '');
  const [dishName, setDishName] = useState('');
  const [servings, setServings] = useState(1);
  const [dietaryLabels, setDietaryLabels] = useState('');
  const [error, setError] = useState<string | null>(null);

  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);

  const mutation = trpc.potluck.adminCreateSignup.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Signup created');
      router.refresh();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit() {
    setError(null);
    if (!slotId || !rsvpId) {
      setError('Pick a slot and a household');
      return;
    }
    const labels = dietaryLabels
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l !== '');
    mutation.mutate({
      eventId,
      slotId,
      rsvpId,
      dishName: dishName.trim(),
      servings,
      dietaryLabels: labels,
    });
  }

  return (
    <Modal isOpen onClose={onClose} title={`Add signup · ${eventName}`} size="md">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="admin-create-slot"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Slot
          </label>
          <select
            id="admin-create-slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            data-testid="create-slot"
          >
            {slots.map((slot) => {
              const label = slot.name ?? POTLUCK_CATEGORY_LABELS[slot.category] ?? slot.category;
              const capacity =
                slot.slotType === 'LIMITED'
                  ? ` (${slot.currentSignups}/${slot.maxSignups})`
                  : ` (${slot.currentSignups})`;
              return (
                <option key={slot.id} value={slot.id}>
                  {label} · {POTLUCK_CATEGORY_LABELS[slot.category] ?? slot.category}
                  {capacity}
                </option>
              );
            })}
          </select>
          {slotById.get(slotId)?.slotType === 'LIMITED' ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Limited capacity ({slotById.get(slotId)?.currentSignups}/
              {slotById.get(slotId)?.maxSignups} claimed)
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="admin-create-household"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Household
          </label>
          <select
            id="admin-create-household"
            value={rsvpId}
            onChange={(e) => setRsvpId(e.target.value)}
            className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            data-testid="create-household"
          >
            {households.map((h) => (
              <option key={h.rsvpId} value={h.rsvpId}>
                {h.householdName} · {h.userName} · {h.rsvpStatus}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="admin-create-dish-name"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Dish name
          </label>
          <input
            id="admin-create-dish-name"
            type="text"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            maxLength={80}
            placeholder="What is being brought?"
            className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            data-testid="create-dish-name"
          />
        </div>

        <div>
          <label
            htmlFor="admin-create-servings"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Servings
          </label>
          <select
            id="admin-create-servings"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            data-testid="create-servings"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n} serving{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="admin-create-dietary"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Dietary labels
            <span className="text-muted-foreground ml-1 text-xs font-normal">(optional)</span>
          </label>
          <input
            id="admin-create-dietary"
            type="text"
            value={dietaryLabels}
            onChange={(e) => setDietaryLabels(e.target.value)}
            placeholder="vegetarian, gluten-free, nut-free"
            maxLength={500}
            className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            data-testid="create-dietary"
          />
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert" data-testid="error-message">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="bg-sage text-sage-foreground hover:bg-sage-hover rounded-sm px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="save-create"
          >
            {mutation.isPending ? 'Saving…' : 'Add signup'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
