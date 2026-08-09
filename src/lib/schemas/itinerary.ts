import { z } from 'zod';

// FPP-45 / QUB-31.2: Zod schemas for the admin itinerary items
// CRUD endpoints. Time is stored as a wall-clock string (HH:MM[:SS])
// on the event's timezone; the admin form picks a time with the
// same datetime-local input the event form already uses (QUB-14).

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const timeFieldSchema = z
  .string()
  .regex(timePattern, 'Time must be HH:MM or HH:MM:SS')
  .optional()
  .or(z.literal(''));

// For updates, distinguish between "not provided" (undefined, leave
// alone) and "explicitly cleared" (empty string, store null).
const timeUpdateFieldSchema = z
  .union([
    z.string().regex(timePattern, 'Time must be HH:MM or HH:MM:SS'),
    z.literal(''),
    z.undefined(),
  ])
  .optional();

export const itineraryItemCreateSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  time: z
    .union([z.string().regex(timePattern, 'Time must be HH:MM or HH:MM:SS'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => {
      if (v === undefined) return null;
      const trimmed = v.trim();
      return trimmed === '' ? null : trimmed;
    }),
});

export const itineraryItemUpdateSchema = z
  .object({
    id: z.string().min(1, 'Item ID is required'),
    time: timeUpdateFieldSchema,
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z
      .string()
      .max(2000)
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        const trimmed = v.trim();
        return trimmed === '' ? null : trimmed;
      }),
  })
  .strict();

export const itineraryItemReorderSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  // Ordered list of itinerary item ids. The server rewrites the
  // `order` column so the i-th id in the array gets `order = i`.
  itemIds: z.array(z.string().min(1)).min(1, 'At least one item id is required'),
});

export const itineraryItemDeleteSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
});

export type ItineraryItemCreateInput = z.infer<typeof itineraryItemCreateSchema>;
export type ItineraryItemUpdateInput = z.infer<typeof itineraryItemUpdateSchema>;
export type ItineraryItemReorderInput = z.infer<typeof itineraryItemReorderSchema>;
export type ItineraryItemDeleteInput = z.infer<typeof itineraryItemDeleteSchema>;
