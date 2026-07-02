import { z } from 'zod';

export const dependentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').trim().min(1),
  relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN'] as const),
  age: z.number().int().positive().optional(),
  dietaryLabels: z.array(z.string()).default([]),
  isChild: z.boolean().default(false),
});

export const dependentUpdateSchema = z.object({
  id: z.string().min(1, 'Dependent ID is required'),
  name: z.string().trim().min(1, 'Name cannot be empty').optional(),
  relationship: z
    .enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN'] as const)
    .optional(),
  age: z.number().int().positive().nullable().optional(),
  dietaryLabels: z.array(z.string()).optional(),
  isChild: z.boolean().optional(),
});

export const dependentDeleteSchema = z.object({
  id: z.string().min(1, 'Dependent ID is required'),
});

export type DependentCreateInput = z.infer<typeof dependentCreateSchema>;
export type DependentUpdateInput = z.infer<typeof dependentUpdateSchema>;
export type DependentDeleteInput = z.infer<typeof dependentDeleteSchema>;
