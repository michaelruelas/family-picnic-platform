import { z } from 'zod';

const eventFields = {
  name: z.string().min(1, 'Event name is required'),
  date: z.string().min(1, 'Event date is required'),
  location: z.string().min(1, 'Location is required'),
  // FPP-145: optional host-defined display name. Empty string clears
  // the field so the public page falls back to `location`.
  customLocationName: z.string().optional().nullable().or(z.literal('')),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  placeId: z.string().optional().nullable(),
  description: z.string().optional().default(''),
  // FPP-136: optional additional info markdown/notes for guests.
  additionalInfo: z.string().optional().nullable().or(z.literal('')),
  rsvpDeadline: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
  mapImageUrl: z.string().url().optional().or(z.literal('')),
  // FPP-60: optional per-event hero image URL. Stored as a public
  // S3 URL once the admin upload PUT lands; an empty string clears
  // the field. The public hero falls back to `mapImageUrl` (then a
  // gradient) when this is unset.
  featuredImageUrl: z.string().url().optional().or(z.literal('')),
  currency: z.string().optional(),
  // Optional per-attendee fee in cents. Null/0 means registration is free
  // and the Stripe checkout flow is hidden.
  registrationFeeCents: z.number().int().nonnegative().optional(),
  // Minimum age (inclusive) for an attendee to owe the per-attendee fee.
  // 0 means "everyone pays", which is the default. Attendees with a
  // missing age (`null`) are skipped by the calculator, never silently
  // billed. Upper bound matches the HouseholdMember.age column cap.
  registrationFeeMinAge: z.number().int().min(0).max(120).optional(),
};

const eventBaseSchema = z.object(eventFields);

const rsvpDeadlineRefine = (data: { rsvpDeadline?: string; date?: string }) => {
  if (data.rsvpDeadline && data.date) {
    const deadline = new Date(data.rsvpDeadline);
    const eventDate = new Date(data.date);
    return deadline <= eventDate;
  }
  return true;
};

export const eventCreateSchema = eventBaseSchema.refine(rsvpDeadlineRefine, {
  message: 'RSVP deadline must be before the event date',
  path: ['rsvpDeadline'],
});

export const eventUpdateSchema = z
  .object({
    id: z.string().min(1, 'Event ID is required'),
    name: z.string().min(1, 'Event name is required').optional(),
    date: z.string().min(1, 'Event date is required').optional(),
    location: z.string().min(1, 'Location is required').optional(),
    customLocationName: z.string().optional().nullable().or(z.literal('')),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    placeId: z.string().optional().nullable(),
    description: z.string().optional(),
    additionalInfo: z.string().optional().nullable().or(z.literal('')),
    rsvpDeadline: z.string().optional(),
    maxCapacity: z.number().int().positive().optional(),
    mapImageUrl: z.string().url().optional().or(z.literal('')),
    featuredImageUrl: z.string().url().optional().or(z.literal('')),
    currency: z.string().optional(),
    registrationFeeCents: z.number().int().nonnegative().optional(),
    registrationFeeMinAge: z.number().int().min(0).max(120).optional(),
  })
  .refine(rsvpDeadlineRefine, {
    message: 'RSVP deadline must be before the event date',
    path: ['rsvpDeadline'],
  });

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
