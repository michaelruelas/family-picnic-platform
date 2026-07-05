'use client';

import { useState } from 'react';
import { usePotluckSignupMutation } from '~/hooks';
import { SlotType } from '~/lib/generated/enums';

interface PotluckSlot {
  id: string;
  name: string;
  slotType: SlotType;
  maxSignups: number | null;
  currentSignups: number;
  signups: Array<{
    id: string;
    dishName: string;
    servings: number;
    dietaryLabels: string[];
    rsvp: {
      userId: string;
    };
  }>;
}

interface PotluckSignupFormProps {
  slot: PotluckSlot;
  userId: string | undefined;
  onSignupChange?: () => void;
}

export default function PotluckSignupForm({
  slot,
  userId,
  onSignupChange,
}: PotluckSignupFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dishName, setDishName] = useState('');
  const [servings, setServings] = useState(1);
  const [dietaryLabels, setDietaryLabels] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { signup, updateSignup, cancelSignup } = usePotluckSignupMutation();

  const userSignup = slot.signups.find((s) => s.rsvp.userId === userId);

  const isLimited = slot.slotType === 'LIMITED';
  const isFull = isLimited && slot.currentSignups >= (slot.maxSignups || 0);
  const isSubmitting = signup.isPending || updateSignup.isPending || cancelSignup.isPending;

  const handleSubmit = async (action: 'signup' | 'cancel') => {
    if (!userId) return;

    setError(null);

    try {
      const labels = dietaryLabels
        .split(',')
        .map((l) => l.trim())
        .filter((l) => l !== '');

      if (action === 'signup') {
        if (userSignup) {
          updateSignup.mutate(
            {
              slotId: slot.id,
              dishName: dishName.trim(),
              servings,
              dietaryLabels: labels,
            },
            {
              onSuccess: () => {
                setIsExpanded(false);
                onSignupChange?.();
              },
              onError: (err) => {
                setError(err.message);
              },
            },
          );
        } else {
          signup.mutate(
            {
              slotId: slot.id,
              dishName: dishName.trim(),
              servings,
              dietaryLabels: labels,
            },
            {
              onSuccess: () => {
                setIsExpanded(false);
                onSignupChange?.();
              },
              onError: (err) => {
                setError(err.message);
              },
            },
          );
        }
      } else {
        cancelSignup.mutate(
          { slotId: slot.id },
          {
            onSuccess: () => {
              setIsExpanded(false);
              onSignupChange?.();
            },
            onError: (err) => {
              setError(err.message);
            },
          },
        );
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  if (!userId) {
    return (
      <span className="bg-secondary text-muted-foreground rounded-lg px-3 py-2 text-sm">
        Sign in to sign up
      </span>
    );
  }

  if (userSignup) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-sage">✓</span>
          <span className="text-foreground/85 font-medium">You&apos;re bringing:</span>
          <span className="text-muted-foreground">{userSignup.dishName}</span>
        </div>
        <div className="mt-1 flex gap-2">
          {!isExpanded ? (
            <button
              onClick={() => {
                setDishName(userSignup.dishName);
                setServings(userSignup.servings);
                setDietaryLabels(userSignup.dietaryLabels.join(', '));
                setIsExpanded(true);
              }}
              className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 mt-1 rounded-lg px-3 py-1 text-sm font-medium"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={() => setIsExpanded(false)}
              className="bg-secondary text-muted-foreground hover:bg-secondary mt-1 rounded-lg px-3 py-1 text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="border-border bg-secondary/60 mt-3 rounded-lg border p-3">
            <h4 className="text-foreground text-sm font-medium">Edit Your Signup</h4>
            {error && (
              <div className="bg-destructive/10 text-destructive mt-2 rounded p-2 text-sm">
                {error}
              </div>
            )}

            <div className="mt-3 space-y-3">
              <div>
                <label className="text-foreground/85 block text-xs font-medium">Dish Name</label>
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="What are you bringing?"
                  className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-2 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-foreground/85 block text-xs font-medium">Servings</label>
                <select
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-2 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} serving{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-foreground/85 block text-xs font-medium">
                  Dietary Labels (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={dietaryLabels}
                  onChange={(e) => setDietaryLabels(e.target.value)}
                  placeholder="vegetarian, gluten-free, nut-free"
                  className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-2 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSubmit('signup')}
                  disabled={isSubmitting || !dishName.trim()}
                  className="bg-terracotta hover:bg-terracotta flex-1 rounded-lg px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => handleSubmit('cancel')}
                  disabled={isSubmitting}
                  className="bg-destructive/15 text-destructive hover:bg-destructive/20 rounded-lg px-3 py-1 text-sm font-medium disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isFull) {
    return (
      <span className="bg-secondary text-muted-foreground rounded-lg px-3 py-2 text-sm">Full</span>
    );
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 text-sm font-medium text-white"
      >
        Sign Up
      </button>
    );
  }

  return (
    <div className="border-border bg-secondary/60 mt-3 rounded-lg border p-3">
      <h4 className="text-foreground text-sm font-medium">Sign Up for {slot.name}</h4>
      {error && (
        <div className="bg-destructive/10 text-destructive mt-2 rounded p-2 text-sm">{error}</div>
      )}

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-foreground/85 block text-xs font-medium">Dish Name</label>
          <input
            type="text"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            placeholder="What are you bringing?"
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-2 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-foreground/85 block text-xs font-medium">Servings</label>
          <select
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-2 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} serving{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-foreground/85 block text-xs font-medium">
            Dietary Labels (optional, comma-separated)
          </label>
          <input
            type="text"
            value={dietaryLabels}
            onChange={(e) => setDietaryLabels(e.target.value)}
            placeholder="vegetarian, gluten-free, nut-free"
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-2 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit('signup')}
            disabled={isSubmitting || !dishName.trim()}
            className="bg-terracotta hover:bg-terracotta flex-1 rounded-lg px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            disabled={isSubmitting}
            className="bg-secondary text-muted-foreground hover:bg-secondary rounded-lg px-3 py-1 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
