'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EventFormData {
  name: string;
  date: string;
  location: string;
  description: string;
  rsvpDeadline?: string;
  maxCapacity?: number;
  mapImageUrl?: string;
}

interface EventFormProps {
  initialData?: EventFormData & { id: string };
  mode: 'create' | 'edit';
}

export default function EventForm({ initialData, mode }: EventFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<EventFormData>({
    name: initialData?.name ?? '',
    date: initialData?.date ?? '',
    location: initialData?.location ?? '',
    description: initialData?.description ?? '',
    rsvpDeadline: initialData?.rsvpDeadline ?? '',
    maxCapacity: initialData?.maxCapacity ?? undefined,
    mapImageUrl: initialData?.mapImageUrl ?? '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'maxCapacity' ? (value ? Number(value) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = mode === 'create' ? '/api/admin/events' : `/api/admin/events/${initialData?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save event');
        return;
      }

      router.push('/admin/events');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Event Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            placeholder="Annual Family Picnic"
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-stone-700">
            Location *
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            placeholder="Central Park Pavilion"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-stone-700">
            Event Date *
          </label>
          <input
            type="datetime-local"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="rsvpDeadline" className="block text-sm font-medium text-stone-700">
            RSVP Deadline
          </label>
          <input
            type="datetime-local"
            id="rsvpDeadline"
            name="rsvpDeadline"
            value={formData.rsvpDeadline}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="maxCapacity" className="block text-sm font-medium text-stone-700">
            Max Capacity
          </label>
          <input
            type="number"
            id="maxCapacity"
            name="maxCapacity"
            value={formData.maxCapacity ?? ''}
            onChange={handleChange}
            min="1"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            placeholder="Leave empty for unlimited"
          />
        </div>

        <div>
          <label htmlFor="mapImageUrl" className="block text-sm font-medium text-stone-700">
            Map Image URL
          </label>
          <input
            type="url"
            id="mapImageUrl"
            name="mapImageUrl"
            value={formData.mapImageUrl}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          placeholder="Join us for our annual family picnic..."
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/events')}
          className="flex-1 rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
