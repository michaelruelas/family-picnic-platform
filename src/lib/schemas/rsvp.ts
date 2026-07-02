import { z } from 'zod';
import { RSVPStatus } from '~/lib/generated/enums';

export const rsvpConfirmSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  headcount: z.number().int().min(1).default(1),
  dietaryNotes: z.string().optional(),
});

export const rsvpDeclineSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
});

export const rsvpUpdateSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  headcount: z.number().int().min(1),
  dietaryNotes: z.string().optional(),
});

export const rsvpAdminOverrideSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  status: z.enum([RSVPStatus.CONFIRMED, RSVPStatus.DECLINED]),
  headcount: z.number().int().min(0).optional(),
  dietaryNotes: z.string().optional(),
});

export type RsvpConfirmInput = z.infer<typeof rsvpConfirmSchema>;
export type RsvpDeclineInput = z.infer<typeof rsvpDeclineSchema>;
export type RsvpUpdateInput = z.infer<typeof rsvpUpdateSchema>;
export type RsvpAdminOverrideInput = z.infer<typeof rsvpAdminOverrideSchema>;
