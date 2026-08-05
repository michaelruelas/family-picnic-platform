import { z } from 'zod';
import { attendeeNameSchema } from './attendee-name';

export const householdMemberCreateSchema = z.object({
  householdId: z.string().min(1, 'Household ID is required'),
  name: attendeeNameSchema,
  age: z.number().int().nonnegative().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const householdMemberUpdateSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
  name: attendeeNameSchema.optional(),
  age: z.number().int().nonnegative().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const householdMemberDeleteSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
});

export type HouseholdMemberCreateInput = z.infer<typeof householdMemberCreateSchema>;
export type HouseholdMemberUpdateInput = z.infer<typeof householdMemberUpdateSchema>;
export type HouseholdMemberDeleteInput = z.infer<typeof householdMemberDeleteSchema>;
