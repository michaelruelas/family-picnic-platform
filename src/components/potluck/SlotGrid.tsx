'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SlotForm from './SlotForm';

interface PotluckSlot {
  id: string;
  name: string;
  category: string;
  slotType: string;
  maxSignups: number | null;
  currentSignups: number;
  signups: Array<{
    id: string;
    dishName: string;
    servings: number;
    dietaryLabels: string[];
  }>;
}

interface SlotGridProps {
  eventId: string;
  slots: PotluckSlot[];
}

const categoryLabels: Record<string, string> = {
  MAIN: 'Main Dishes',
  SIDE: 'Side Dishes',
  DESSERT: 'Desserts',
  DRINK: 'Drinks',
  OTHER: 'Other Items',
};

const categoryEmojis: Record<string, string> = {
  MAIN: '🍖',
  SIDE: '🥗',
  DESSERT: '🍰',
  DRINK: '🥤',
  OTHER: '📦',
};

export default function SlotGrid({ eventId, slots }: SlotGridProps) {
  const router = useRouter();
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slotsByCategory = slots.reduce(
    (acc, slot) => {
      if (!acc[slot.category]) {
        acc[slot.category] = [];
      }
      acc[slot.category]!.push(slot);
      return acc;
    },
    {} as Record<string, PotluckSlot[]>,
  );

  const handleDelete = async (slotId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/potluck-slots/${slotId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete slot');
        return;
      }

      setDeleteConfirm(null);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const handleUpdate = async (slotId: string, name: string, maxSignups: number | undefined) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/potluck-slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, maxSignups }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update slot');
        return;
      }

      setEditingSlot(null);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  if (slots.length === 0 && !showAddForm) {
    return (
      <div className="rounded-xl bg-amber-50 p-8 text-center">
        <div className="text-5xl">🍴</div>
        <h3 className="mt-4 text-xl font-semibold text-amber-900">No Potluck Slots Yet</h3>
        <p className="mt-2 text-amber-700">Add slots to let attendees sign up to bring dishes.</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-4 rounded-lg bg-amber-600 px-6 py-2 font-medium text-white hover:bg-amber-700"
        >
          Add First Slot
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {showAddForm && <SlotForm eventId={eventId} onSuccess={() => setShowAddForm(false)} />}

      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
        >
          <span className="text-lg">+</span> Add Potluck Slot
        </button>
      )}

      {Object.entries(slotsByCategory).map(([category, categorySlots]) => (
        <div key={category} className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <span className="text-2xl">{categoryEmojis[category] || '📦'}</span>
            {categoryLabels[category] || category}
          </h3>

          <div className="mt-4 space-y-3">
            {categorySlots.map((slot) => (
              <div key={slot.id} className="rounded-lg border border-stone-200 p-4">
                {editingSlot === slot.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={slot.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        handleUpdate(
                          slot.id,
                          newName,
                          slot.slotType === 'LIMITED' ? (slot.maxSignups ?? 1) : undefined,
                        );
                      }}
                      className="block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      placeholder="Slot name"
                    />
                    {slot.slotType === 'LIMITED' && (
                      <input
                        type="number"
                        value={slot.maxSignups ?? 1}
                        onChange={(e) => {
                          const newMax = Number(e.target.value);
                          handleUpdate(slot.id, slot.name, newMax);
                        }}
                        min="1"
                        max="100"
                        className="block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSlot(null)}
                        className="flex-1 rounded-lg bg-stone-200 px-3 py-1 text-sm font-medium text-stone-700 hover:bg-stone-300"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : deleteConfirm === slot.id ? (
                  <div className="space-y-2">
                    <p className="text-sm text-stone-700">
                      Delete <strong>{slot.name}</strong>? This will also remove all signups.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(slot.id)}
                        disabled={false}
                        className="flex-1 rounded-lg bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 rounded-lg bg-stone-200 px-3 py-1 text-sm font-medium text-stone-700 hover:bg-stone-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-stone-900">{slot.name}</p>
                      <p className="text-sm text-stone-500">
                        {slot.slotType === 'UNLIMITED'
                          ? `${slot.currentSignups} signups`
                          : `${slot.currentSignups}/${slot.maxSignups} slots filled`}
                      </p>
                      {slot.signups.length > 0 && (
                        <p className="mt-1 text-xs text-stone-400">
                          {slot.signups.map((s) => s.dishName).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSlot(slot.id)}
                        className="rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(slot.id)}
                        className="rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
