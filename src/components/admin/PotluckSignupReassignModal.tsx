'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '~/components/ui/Modal';
import { useToast } from '~/components/ui/Toast';
import { trpc } from '~/lib/trpc-client';
import { POTLUCK_CATEGORY_LABELS } from '~/lib/constants';
import type {
  AdminPotluckSlotOption,
  AdminPotluckHouseholdOption,
} from './PotluckSignupCreateModal';

interface AdminPotluckReassignModalProps {
  eventName: string;
  signup: {
    id: string;
    dishName: string;
    householdName: string;
    slotId: string;
    rsvpId: string;
  };
  slots: AdminPotluckSlotOption[];
  households: AdminPotluckHouseholdOption[];
  onClose: () => void;
}

export default function PotluckSignupReassignModal({
  eventName,
  signup,
  slots,
  households,
  onClose,
}: AdminPotluckReassignModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [slotId, setSlotId] = useState(signup.slotId);
  const [rsvpId, setRsvpId] = useState(signup.rsvpId);
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.potluck.adminReassignSignup.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Signup reassigned');
      router.refresh();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit() {
    setError(null);
    if (slotId === signup.slotId && rsvpId === signup.rsvpId) {
      onClose();
      return;
    }
    mutation.mutate({ signupId: signup.id, slotId, rsvpId });
  }

  return (
    <Modal isOpen onClose={onClose} title={`Reassign signup · ${eventName}`} size="md">
      <div className="space-y-4">
        <div className="bg-secondary rounded-sm p-3 text-sm">
          <p className="text-foreground font-semibold">{signup.dishName || 'Unnamed dish'}</p>
          <p className="text-muted-foreground text-xs">{signup.householdName}</p>
        </div>

        <div>
          <label
            htmlFor="admin-reassign-slot"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Slot
          </label>
          <select
            id="admin-reassign-slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            data-testid="reassign-slot"
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
        </div>

        <div>
          <label
            htmlFor="admin-reassign-household"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Household
          </label>
          <select
            id="admin-reassign-household"
            value={rsvpId}
            onChange={(e) => setRsvpId(e.target.value)}
            className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
            data-testid="reassign-household"
          >
            {households.map((h) => (
              <option key={h.rsvpId} value={h.rsvpId}>
                {h.householdName} · {h.userName} · {h.rsvpStatus}
              </option>
            ))}
          </select>
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
            className="bg-terracotta hover:bg-terracotta rounded-sm px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="save-reassign"
          >
            {mutation.isPending ? 'Reassigning…' : 'Reassign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
