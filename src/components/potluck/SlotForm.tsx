'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SlotFormData {
  category: 'MAIN' | 'SIDE' | 'DESSERT' | 'DRINK' | 'OTHER';
  name: string;
  slotType: 'LIMITED' | 'UNLIMITED';
  maxSignups: number;
}

interface SlotFormProps {
  eventId: string;
  initialData?: {
    id: string;
    name: string;
    category: string;
    slotType: string;
    maxSignups: number | null;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SlotForm({ eventId, initialData, onSuccess, onCancel }: SlotFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SlotFormData>({
    category: (initialData?.category as SlotFormData['category']) ?? 'MAIN',
    name: initialData?.name ?? '',
    slotType: (initialData?.slotType as SlotFormData['slotType']) ?? 'LIMITED',
    maxSignups: initialData?.maxSignups ?? 1,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'maxSignups' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const isEdit = !!initialData?.id;
      const response = await fetch('/api/admin/potluck-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          category: formData.category,
          name: formData.name.trim(),
          slotType: formData.slotType,
          maxSignups: formData.slotType === 'LIMITED' ? formData.maxSignups : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save slot');
        return;
      }

      setFormData({
        category: 'MAIN',
        name: '',
        slotType: 'LIMITED',
        maxSignups: 1,
      });
      router.refresh();
      onSuccess?.();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-stone-900">
        {initialData ? 'Edit Potluck Slot' : 'Add Potluck Slot'}
      </h3>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-stone-700">
            Category *
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            disabled={!!initialData}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
          >
            <option value="MAIN">Main Dishes</option>
            <option value="SIDE">Side Dishes</option>
            <option value="DESSERT">Desserts</option>
            <option value="DRINK">Drinks</option>
            <option value="OTHER">Other Items</option>
          </select>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Slot Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g., Salad, Brownies, Lemonade"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700">
            Slot Type *
          </label>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="slotType"
                value="LIMITED"
                checked={formData.slotType === 'LIMITED'}
                onChange={handleChange}
                className="h-4 w-4 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-stone-700">Limited</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="slotType"
                value="UNLIMITED"
                checked={formData.slotType === 'UNLIMITED'}
                onChange={handleChange}
                className="h-4 w-4 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-stone-700">Unlimited</span>
            </label>
          </div>
        </div>

        {formData.slotType === 'LIMITED' && (
          <div>
            <label htmlFor="maxSignups" className="block text-sm font-medium text-stone-700">
              Max Signups *
            </label>
            <input
              type="number"
              id="maxSignups"
              name="maxSignups"
              value={formData.maxSignups}
              onChange={handleChange}
              required
              min="1"
              max="100"
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Update Slot' : 'Add Slot'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
