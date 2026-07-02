'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PotluckSlot {
  id: string;
  name: string;
  slotType: string;
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
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dishName, setDishName] = useState('');
  const [servings, setServings] = useState(1);
  const [dietaryLabels, setDietaryLabels] = useState('');
  const [error, setError] = useState<string | null>(null);

  const userSignup = slot.signups.find((s) => s.rsvp.userId === userId);

  const isLimited = slot.slotType === 'LIMITED';
  const isFull = isLimited && slot.currentSignups >= (slot.maxSignups || 0);

  const handleSubmit = async (action: 'signup' | 'cancel') => {
    if (!userId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/potluck-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          action,
          dishName: dishName.trim(),
          servings,
          dietaryLabels: dietaryLabels
            .split(',')
            .map((l) => l.trim())
            .filter((l) => l !== ''),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Failed to ${action} signup`);
        return;
      }

      setIsExpanded(false);
      router.refresh();
      onSignupChange?.();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
        Sign in to sign up
      </span>
    );
  }

  if (userSignup) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-500">✓</span>
          <span className="font-medium text-stone-700">You&apos;re bringing:</span>
          <span className="text-stone-600">{userSignup.dishName}</span>
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
              className="mt-1 rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-200"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={() => setIsExpanded(false)}
              className="mt-1 rounded-lg bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600 hover:bg-stone-200"
            >
              Cancel
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <h4 className="text-sm font-medium text-stone-900">Edit Your Signup</h4>
            {error && (
              <div className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
            )}

            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700">Dish Name</label>
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="What are you bringing?"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">Servings</label>
                <select
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} serving{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Dietary Labels (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={dietaryLabels}
                  onChange={(e) => setDietaryLabels(e.target.value)}
                  placeholder="vegetarian, gluten-free, nut-free"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSubmit('signup')}
                  disabled={isSubmitting || !dishName.trim()}
                  className="flex-1 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => handleSubmit('cancel')}
                  disabled={isSubmitting}
                  className="rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
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
    return <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">Full</span>;
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        Sign Up
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <h4 className="text-sm font-medium text-stone-900">Sign Up for {slot.name}</h4>
      {error && <div className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-stone-700">Dish Name</label>
          <input
            type="text"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            placeholder="What are you bringing?"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700">Servings</label>
          <select
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} serving{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700">
            Dietary Labels (optional, comma-separated)
          </label>
          <input
            type="text"
            value={dietaryLabels}
            onChange={(e) => setDietaryLabels(e.target.value)}
            placeholder="vegetarian, gluten-free, nut-free"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit('signup')}
            disabled={isSubmitting || !dishName.trim()}
            className="flex-1 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            disabled={isSubmitting}
            className="rounded-lg bg-stone-200 px-3 py-1 text-sm font-medium text-stone-600 hover:bg-stone-300 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
