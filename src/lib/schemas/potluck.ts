import { z } from 'zod';

export const potluckSlotTypeSchema = z.enum(['LIMITED', 'UNLIMITED']);

export const potluckSignupSchema = z.object({
  slotId: z.string().min(1, 'Slot ID is required'),
  action: z.enum(['signup', 'cancel']),
  dishName: z.string().max(80, 'Dish name is too long').optional(),
  servings: z.number().int().min(1).default(1).optional(),
  dietaryLabels: z.array(z.string()).default([]).optional(),
});

export const potluckSignupInputSchema = z.object({
  slotId: z.string().min(1, 'Slot ID is required'),
  dishName: z.string().trim().max(80, 'Dish name is too long').default(''),
  servings: z.number().int().min(1).default(1),
  dietaryLabels: z.array(z.string()).default([]),
});

export type PotluckSignupInput = z.infer<typeof potluckSignupInputSchema>;
