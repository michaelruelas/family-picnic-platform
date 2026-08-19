'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { eventCreateSchema, eventUpdateSchema } from '~/lib/schemas';
import { isEventWindowAfter } from '~/lib/event-window';
import DateTimePicker from '~/components/ui/DateTimePicker';
import { LocationAutocomplete } from './LocationAutocomplete';
import FeaturedImageUpload from './FeaturedImageUpload';
import RichTextEditor from './RichTextEditor';

interface EventFormData {
  name: string;
  date: string;
  // FPP-145 follow-up: form holds the location data as TWO fields:
  //   customLocationName: host-typed display title (primary location string)
  //   location:          Google Places formatted address (secondary, for the map)
  // The two are decoupled — typing in one does not clear the other.
  location: string;
  customLocationName?: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  description: string;
  additionalInfo?: string;
  rsvpDeadline?: string;
  maxCapacity?: number;
  mapImageUrl?: string;
  featuredImageUrl?: string;
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
    // FPP-145: defaults to the stored customLocationName when editing
    // an event that already has one, so the host can iterate on the
    // existing display label without retyping.
    customLocationName: initialData?.customLocationName ?? '',
    lat: initialData?.lat ?? null,
    lng: initialData?.lng ?? null,
    placeId: initialData?.placeId ?? null,
    description: initialData?.description ?? '',
    additionalInfo: initialData?.additionalInfo ?? '',
    rsvpDeadline: initialData?.rsvpDeadline ?? '',
    maxCapacity: initialData?.maxCapacity ?? undefined,
    mapImageUrl: initialData?.mapImageUrl ?? '',
    featuredImageUrl: initialData?.featuredImageUrl ?? '',
    registrationFeeDollars: initialFeeDollars,
    registrationFeeMinAge: initialMinAge,
  });

  const handleCustomNameChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, customLocationName: value }));
  }, []);

  const handleResolvedChange = useCallback(
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
    const {
      registrationFeeDollars,
      registrationFeeMinAge: _omit,
      location,
      customLocationName,
      ...rest
    } = formData;
    void registrationFeeDollars;
    void _omit;
    // FPP-145 follow-up: the `location` column is non-null in the DB.
    // When the host types a custom name without picking from Google,
    // fall back to that name so the required string is still set.
    // The public page will surface both fields via customLocationName
    // ?? location so the UI never has to reach for this fallback.
    const effectiveLocation = location || customLocationName || '';
    return {
      ...rest,
      location: effectiveLocation,
      // FPP-145: empty string clears the column so the public page
      // falls back to the resolved Google address. Matches the
      // additionalInfo / featuredImageUrl clear-by-empty contract.
      customLocationName: customLocationName?.trim() ? customLocationName : undefined,
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

  // FPP-62: the DateTimePicker forwards the new value as a plain string
  // instead of an event, so wrap the assignment here. When the host
  // pushes the event date forward we also have to wipe any RSVP
  // deadline that would now sit past the new event date, otherwise the
  // pair would fail the schema's `rsvpDeadline <= date` invariant on
  // submit and the user would only learn about it after pressing save.
  // FPP-62 follow-up (SP-3): the comparison is delegated to
  // `isEventWindowAfter` so the format dependency lives in one place.
  const handleDateChange = (value: string) => {
    setFormData((prev) => {
      const next = { ...prev, date: value };
      if (isEventWindowAfter(next.rsvpDeadline ?? '', value)) {
        next.rsvpDeadline = '';
      }
      return next;
    });
  };

  const handleRsvpDeadlineChange = (value: string) => {
    setFormData((prev) => ({ ...prev, rsvpDeadline: value }));
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
    <form onSubmit={handleSubmit} className="bg-card space-y-6 rounded-sm p-6 shadow-sm">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-sm p-4 text-sm">{error}</div>
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
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="Annual Family Picnic"
          />
        </div>

        <div className="md:col-span-2">
          <LocationAutocomplete
            customNameValue={formData.customLocationName ?? ''}
            resolvedAddress={formData.location}
            onCustomNameChange={handleCustomNameChange}
            onResolvedChange={handleResolvedChange}
          />
        </div>

        <div>
          <DateTimePicker
            label="Event Date"
            name="date"
            value={formData.date}
            onChange={handleDateChange}
            required
            // FPP-62: keep the event date inside the event window. If the
            // host already pinned an RSVP deadline, the event date must
            // sit on or after it.
            min={formData.rsvpDeadline || undefined}
            data-testid="event-date-input"
          />
        </div>

        <div>
          <DateTimePicker
            label="RSVP Deadline"
            name="rsvpDeadline"
            value={formData.rsvpDeadline}
            onChange={handleRsvpDeadlineChange}
            // FPP-62: the RSVP deadline cannot land after the event date.
            max={formData.date || undefined}
            hint="Optional. If blank, RSVPs stay open until the event starts."
            data-testid="event-rsvp-deadline-input"
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
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
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
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="https://..."
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Fallback hero used when no featured image is set.
          </p>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="featuredImageUrl"
            className="text-foreground/85 block text-sm font-medium"
          >
            Featured Image
          </label>
          <p className="text-muted-foreground mt-1 text-xs">
            Hero photo shown at the top of the event page. Overrides the map when set.
          </p>
          <div className="mt-2 space-y-2">
            <input
              type="url"
              id="featuredImageUrl"
              name="featuredImageUrl"
              value={formData.featuredImageUrl ?? ''}
              onChange={handleChange}
              className="border-border focus:border-terracotta focus:ring-foreground/20 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              placeholder="https://..."
            />
            {mode === 'edit' && initialData?.id && (
              <FeaturedImageUpload
                eventId={initialData.id}
                currentUrl={formData.featuredImageUrl}
                onUploaded={(url) => setFormData((prev) => ({ ...prev, featuredImageUrl: url }))}
              />
            )}
            {mode === 'create' && (
              <p className="text-muted-foreground text-xs">
                Save the event first, then upload an image from the edit page.
              </p>
            )}
          </div>
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
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
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
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
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
        <RichTextEditor
          id="description"
          ariaLabel="Event description"
          value={formData.description}
          onChange={(html) => setFormData((prev) => ({ ...prev, description: html }))}
          className="mt-1"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Shown as &quot;A note from the host&quot; on the event page. Use the toolbar for bold,
          headings, and lists.
        </p>
      </div>

      <div>
        <label htmlFor="additionalInfo" className="text-foreground/85 block text-sm font-medium">
          Additional Info
        </label>
        <RichTextEditor
          id="additionalInfo"
          ariaLabel="Additional info"
          value={formData.additionalInfo ?? ''}
          onChange={(html) => setFormData((prev) => ({ ...prev, additionalInfo: html }))}
          className="mt-1"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Surfaced in the dedicated &quot;Additional Info&quot; tab on the event page. Use the
          toolbar for bold, headings, and lists.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-terracotta hover:bg-terracotta flex-1 rounded-sm px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/events')}
          className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-sm px-4 py-2 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
