import { z } from 'zod';
import { e164Schema, requirePhoneIfWantsSms } from './sms';

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    communicationPreference: z.enum(['EMAIL', 'SMS', 'BOTH', 'NONE'] as const).optional(),
    phoneNumber: e164Schema.optional().nullable(),
    smsConsent: z.boolean().optional(),
  })
  .superRefine(requirePhoneIfWantsSms);

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
