import { z } from 'zod';
import { attendeeNameSchema } from './attendee-name';

// FPP-122: age is required on every household member because the
// per-attendee registration fee is computed from it. The schema
// permits 0 (newborn) up to 120 and rejects NaN / negative values.
const requiredAgeSchema = z
  .number({ error: 'Age is required' })
  .int('Age must be a whole number')
  .nonnegative('Age cannot be negative')
  .max(120, 'Age must be 120 or fewer');

export const householdMemberCreateSchema = z.object({
  householdId: z.string().min(1, 'Household ID is required'),
  name: attendeeNameSchema,
  age: requiredAgeSchema,
  notes: z.string().trim().max(500).nullable().optional(),
});

export const householdMemberUpdateSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
  name: attendeeNameSchema.optional(),
  age: requiredAgeSchema.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const householdMemberDeleteSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
});

export type HouseholdMemberCreateInput = z.infer<typeof householdMemberCreateSchema>;
export type HouseholdMemberUpdateInput = z.infer<typeof householdMemberUpdateSchema>;
export type HouseholdMemberDeleteInput = z.infer<typeof householdMemberDeleteSchema>;
