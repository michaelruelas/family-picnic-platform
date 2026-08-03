import { z } from 'zod';

export const HOUSEHOLD_NAME_MIN = 1;
export const HOUSEHOLD_NAME_MAX = 80;

export const householdNameSchema = z
  .string()
  .trim()
  .min(HOUSEHOLD_NAME_MIN, 'Household name is required')
  .max(HOUSEHOLD_NAME_MAX, `Household name must be ${HOUSEHOLD_NAME_MAX} characters or fewer`);

export const householdCreateSchema = z.object({
  name: householdNameSchema,
  parentHouseholdId: z.string().optional(),
});

export const householdUpdateSchema = z.object({
  id: z.string().min(1, 'Household id is required'),
  name: householdNameSchema,
});

export type HouseholdCreateInput = z.infer<typeof householdCreateSchema>;
export type HouseholdUpdateInput = z.infer<typeof householdUpdateSchema>;
