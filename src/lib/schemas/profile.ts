import { z } from 'zod';

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  communicationPreference: z.enum(['EMAIL', 'SMS', 'BOTH', 'NONE'] as const).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
