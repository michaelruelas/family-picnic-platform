'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { eventCreateSchema, eventUpdateSchema } from '~/lib/schemas';

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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
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

    const schema = mode === 'create' ? eventCreateSchema : eventUpdateSchema;
    const parseResult = schema.safeParse(
      mode === 'create' ? formData : { ...formData, id: initialData?.id },
    );

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]!;
      setError(firstError.message);
      setIsSubmitting(false);
      return;
    }

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
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-foreground/85 block text-sm font-medium">
            Event Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="Annual Family Picnic"
          />
        </div>

        <div>
          <label htmlFor="location" className="text-foreground/85 block text-sm font-medium">
            Location *
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="Central Park Pavilion"
          />
        </div>

        <div>
          <label htmlFor="date" className="text-foreground/85 block text-sm font-medium">
            Event Date *
          </label>
          <input
            type="datetime-local"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="rsvpDeadline" className="text-foreground/85 block text-sm font-medium">
            RSVP Deadline
          </label>
          <input
            type="datetime-local"
            id="rsvpDeadline"
            name="rsvpDeadline"
            value={formData.rsvpDeadline}
            onChange={handleChange}
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="maxCapacity" className="text-foreground/85 block text-sm font-medium">
            Max Capacity
          </label>
          <input
            type="number"
            id="maxCapacity"
            name="maxCapacity"
            value={formData.maxCapacity ?? ''}
            onChange={handleChange}
            min="1"
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="Leave empty for unlimited"
          />
        </div>

        <div>
          <label htmlFor="mapImageUrl" className="text-foreground/85 block text-sm font-medium">
            Map Image URL
          </label>
          <input
            type="url"
            id="mapImageUrl"
            name="mapImageUrl"
            value={formData.mapImageUrl}
            onChange={handleChange}
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="text-foreground/85 block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
          placeholder="Join us for our annual family picnic..."
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-terracotta hover:bg-terracotta flex-1 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/events')}
          className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-lg px-4 py-2 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
