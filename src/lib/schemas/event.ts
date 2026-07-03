import { z } from 'zod';

const eventFields = {
  name: z.string().min(1, 'Event name is required'),
  date: z.string().min(1, 'Event date is required'),
  location: z.string().min(1, 'Location is required'),
  description: z.string().optional().default(''),
  rsvpDeadline: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
  mapImageUrl: z.string().url().optional().or(z.literal('')),
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
    description: z.string().optional(),
    rsvpDeadline: z.string().optional(),
    maxCapacity: z.number().int().positive().optional(),
    mapImageUrl: z.string().url().optional().or(z.literal('')),
  })
  .refine(rsvpDeadlineRefine, {
    message: 'RSVP deadline must be before the event date',
    path: ['rsvpDeadline'],
  });

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
