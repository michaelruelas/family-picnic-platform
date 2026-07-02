import { z } from 'zod';

export const potluckSlotTypeSchema = z.enum(['LIMITED', 'UNLIMITED']);

export const potluckSignupSchema = z.object({
  slotId: z.string().min(1, 'Slot ID is required'),
  action: z.enum(['signup', 'cancel']),
  dishName: z.string().min(1, 'Dish name is required').optional(),
  servings: z.number().int().min(1).default(1).optional(),
  dietaryLabels: z.array(z.string()).default([]).optional(),
});

export const potluckSignupInputSchema = z.object({
  slotId: z.string().min(1, 'Slot ID is required'),
  dishName: z.string().min(1, 'Dish name is required').trim().min(1),
  servings: z.number().int().min(1).default(1),
  dietaryLabels: z.array(z.string()).default([]),
});

export type PotluckSignupInput = z.infer<typeof potluckSignupInputSchema>;
