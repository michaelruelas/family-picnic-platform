import { z } from 'zod';

// FPP-122: dependents feed the per-member attendance list (and, where
// applicable, the registration fee) the same way household members
// do. Require age on create so the roster never ships a row that
// would silently drop out of the fee calc.
export const dependentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').trim().min(1),
  relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN'] as const),
  age: z
    .number({ error: 'Age is required' })
    .int('Age must be a whole number')
    .nonnegative('Age cannot be negative')
    .max(120, 'Age must be 120 or fewer'),
  dietaryLabels: z.array(z.string()).default([]),
  isChild: z.boolean().default(false),
});

export const dependentUpdateSchema = z.object({
  id: z.string().min(1, 'Dependent ID is required'),
  name: z.string().trim().min(1, 'Name cannot be empty').optional(),
  relationship: z
    .enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN'] as const)
    .optional(),
  // FPP-122: age, when present, must be a valid number. Sending
  // null would regress the required-age contract, so reject it.
  age: z
    .number()
    .int('Age must be a whole number')
    .nonnegative('Age cannot be negative')
    .max(120, 'Age must be 120 or fewer')
    .optional(),
  dietaryLabels: z.array(z.string()).optional(),
  isChild: z.boolean().optional(),
});

export const dependentDeleteSchema = z.object({
  id: z.string().min(1, 'Dependent ID is required'),
});

export type DependentCreateInput = z.infer<typeof dependentCreateSchema>;
export type DependentUpdateInput = z.infer<typeof dependentUpdateSchema>;
export type DependentDeleteInput = z.infer<typeof dependentDeleteSchema>;
