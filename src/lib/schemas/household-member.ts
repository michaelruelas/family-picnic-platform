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
  // householdId is optional so the onboarding wizard (where the user
  // has just been assigned to a household and the householdId lives
  // only in their session) can post a member without a client-side
  // round-trip to fetch it. The server falls back to the session
  // user's householdId; if that household is missing or soft-deleted
  // the request is rejected.
  householdId: z.string().min(1).optional(),
  name: attendeeNameSchema,
  age: requiredAgeSchema,
  notes: z.string().trim().max(500).nullable().optional(),
  // Optional relationship (e.g. SPOUSE, CHILD). Kept as a free-form
  // string so the picker list can grow without a Prisma enum change.
  relationship: z.string().trim().max(60).nullable().optional(),
});

export const householdMemberUpdateSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
  name: attendeeNameSchema.optional(),
  age: requiredAgeSchema.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  relationship: z.string().trim().max(60).nullable().optional(),
});

export const householdMemberDeleteSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
});

export type HouseholdMemberCreateInput = z.infer<typeof householdMemberCreateSchema>;
export type HouseholdMemberUpdateInput = z.infer<typeof householdMemberUpdateSchema>;
export type HouseholdMemberDeleteInput = z.infer<typeof householdMemberDeleteSchema>;
