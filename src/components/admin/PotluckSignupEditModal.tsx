'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '~/components/ui/Modal';
import { useToast } from '~/components/ui/Toast';
import { trpc } from '~/lib/trpc-client';

interface AdminPotluckSignupEditModalProps {
  eventName: string;
  signupId: string;
  householdName: string;
  userName: string;
  onClose: () => void;
}

export default function PotluckSignupEditModal({
  eventName,
  signupId,
  householdName,
  userName,
  onClose,
}: AdminPotluckSignupEditModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [dishName, setDishName] = useState('');
  const [servings, setServings] = useState(1);
  const [dietaryLabels, setDietaryLabels] = useState('');
  const [error, setError] = useState<string | null>(null);

  const signupQuery = trpc.potluck.adminGetSignup.useQuery({ signupId });

  if (signupQuery.data) {
    // The modal is mounted by a fresh `key` per signup, so the
    // lookup only succeeds once. Seed the form fields the first
    // time the data lands; subsequent renders skip the writes
    // because the local state already matches.
    if (dishName === '' && servings === 1 && dietaryLabels === '') {
      // Inline assignment — guards avoid an effect's
      // setState-in-effect lint rule.
      setDishName(signupQuery.data.dishName);
      setServings(signupQuery.data.servings);
      setDietaryLabels(signupQuery.data.dietaryLabels.join(', '));
    }
  }

  const mutation = trpc.potluck.adminUpdateSignup.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Signup updated');
      router.refresh();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit() {
    setError(null);
    const labels = dietaryLabels
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l !== '');
    mutation.mutate({
      signupId,
      dishName: dishName.trim(),
      servings,
      dietaryLabels: labels,
    });
  }

  return (
    <Modal isOpen onClose={onClose} title={`Edit signup · ${eventName}`} size="md">
      <div className="space-y-4">
        <div className="bg-secondary rounded-sm p-3 text-sm">
          <p className="text-foreground font-semibold">{householdName}</p>
          <p className="text-muted-foreground text-xs">{userName}</p>
        </div>

        {!signupQuery.data && !signupQuery.error ? (
          <p className="text-muted-foreground text-sm">Loading signup…</p>
        ) : null}
        {signupQuery.error ? (
          <p className="text-destructive text-sm">{signupQuery.error.message}</p>
        ) : null}

        {signupQuery.data ? (
          <>
            <div>
              <label
                htmlFor="admin-edit-dish-name"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Dish name
              </label>
              <input
                id="admin-edit-dish-name"
                type="text"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                maxLength={80}
                className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                data-testid="edit-dish-name"
              />
            </div>

            <div>
              <label
                htmlFor="admin-edit-servings"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Servings
              </label>
              <select
                id="admin-edit-servings"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                data-testid="edit-servings"
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
                htmlFor="admin-edit-dietary"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Dietary labels
                <span className="text-muted-foreground ml-1 text-xs font-normal">(optional)</span>
              </label>
              <input
                id="admin-edit-dietary"
                type="text"
                value={dietaryLabels}
                onChange={(e) => setDietaryLabels(e.target.value)}
                placeholder="vegetarian, gluten-free, nut-free"
                maxLength={500}
                className="border-border bg-card block w-full rounded-sm border px-4 py-3 text-base focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)] focus:outline-none"
                data-testid="edit-dietary"
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
                className="bg-terracotta rounded-sm px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="save-edit"
              >
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
