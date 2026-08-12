'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { eventCreateSchema, eventUpdateSchema } from '~/lib/schemas';
import { LocationAutocomplete } from './LocationAutocomplete';

interface EventFormData {
  name: string;
  date: string;
  location: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  description: string;
  rsvpDeadline?: string;
  maxCapacity?: number;
  mapImageUrl?: string;
  registrationFeeDollars?: string;
  registrationFeeMinAge?: string;
}

interface EventFormInitialData extends Omit<
  EventFormData,
  'registrationFeeDollars' | 'registrationFeeMinAge'
> {
  id: string;
  registrationFeeCents?: number;
  registrationFeeMinAge?: number;
}

interface EventFormProps {
  initialData?: EventFormInitialData;
  mode: 'create' | 'edit';
}

export default function EventForm({ initialData, mode }: EventFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialFeeDollars =
    initialData?.registrationFeeCents !== undefined
      ? (initialData.registrationFeeCents / 100).toFixed(2)
      : '';

  const initialMinAge =
    initialData?.registrationFeeMinAge !== undefined
      ? String(initialData.registrationFeeMinAge)
      : '';

  const [formData, setFormData] = useState<EventFormData>({
    name: initialData?.name ?? '',
    date: initialData?.date ?? '',
    location: initialData?.location ?? '',
    lat: initialData?.lat ?? null,
    lng: initialData?.lng ?? null,
    placeId: initialData?.placeId ?? null,
    description: initialData?.description ?? '',
    rsvpDeadline: initialData?.rsvpDeadline ?? '',
    maxCapacity: initialData?.maxCapacity ?? undefined,
    mapImageUrl: initialData?.mapImageUrl ?? '',
    registrationFeeDollars: initialFeeDollars,
    registrationFeeMinAge: initialMinAge,
  });

  const handleLocationChange = useCallback(
    (data: {
      location: string;
      lat: number | null;
      lng: number | null;
      placeId: string | null;
    }) => {
      setFormData((prev) => ({
        ...prev,
        location: data.location,
        lat: data.lat,
        lng: data.lng,
        placeId: data.placeId,
      }));
    },
    [],
  );

  function buildPayload(): Record<string, unknown> {
    const feeDollars = formData.registrationFeeDollars?.trim();
    const feeCents =
      feeDollars && !Number.isNaN(Number(feeDollars)) ? Math.round(Number(feeDollars) * 100) : 0;
    const minAgeRaw = formData.registrationFeeMinAge?.trim();
    const minAgeParsed = minAgeRaw ? Number(minAgeRaw) : 0;
    const registrationFeeMinAge =
      Number.isFinite(minAgeParsed) && minAgeParsed >= 0 ? Math.floor(minAgeParsed) : 0;
    const { registrationFeeDollars, registrationFeeMinAge: _omit, ...rest } = formData;
    void registrationFeeDollars;
    void _omit;
    return {
      ...rest,
      maxCapacity:
        rest.maxCapacity === undefined || rest.maxCapacity === null
          ? undefined
          : Number(rest.maxCapacity),
      registrationFeeCents: feeCents,
      registrationFeeMinAge,
    };
  }

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
    const payload = buildPayload();
    const parseResult = schema.safeParse(
      mode === 'create' ? payload : { ...payload, id: initialData?.id },
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
        body: JSON.stringify(payload),
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
    <form onSubmit={handleSubmit} className="bg-card space-y-6 rounded-xl p-6 shadow-sm">
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

        <div className="md:col-span-2">
          <label htmlFor="location" className="text-foreground/85 block text-sm font-medium">
            Location * (start typing for address suggestions)
          </label>
          <LocationAutocomplete
            value={formData.location}
            hasGeocodedAddress={formData.lat !== null && formData.lng !== null}
            onChange={handleLocationChange}
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

        <div>
          <label
            htmlFor="registrationFeeDollars"
            className="text-foreground/85 block text-sm font-medium"
          >
            Registration Fee (USD)
          </label>
          <input
            type="number"
            id="registrationFeeDollars"
            name="registrationFeeDollars"
            value={formData.registrationFeeDollars ?? ''}
            onChange={handleChange}
            min="0"
            step="0.01"
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="Leave empty for free events"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            When set above $0, attendees complete payment through Stripe before registration is
            confirmed. Requires STRIPE_SECRET_KEY to be configured.
          </p>
        </div>

        <div>
          <label
            htmlFor="registrationFeeMinAge"
            className="text-foreground/85 block text-sm font-medium"
          >
            Minimum Age for Fee
          </label>
          <input
            type="number"
            id="registrationFeeMinAge"
            name="registrationFeeMinAge"
            value={formData.registrationFeeMinAge ?? ''}
            onChange={handleChange}
            min="0"
            max="120"
            step="1"
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="0"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Attendees aged at or above this threshold owe the fee (per attendee). Default 0 charges
            every attendee. Attendees with no age on file are skipped, never silently billed.
          </p>
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
