import { z } from 'zod';
import { e164Schema } from './sms';

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    communicationPreference: z.enum(['EMAIL', 'SMS', 'BOTH', 'NONE'] as const).optional(),
    phoneNumber: e164Schema.optional().nullable(),
    smsConsent: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const wantsSms =
      value.communicationPreference === 'SMS' ||
      value.communicationPreference === 'BOTH' ||
      value.smsConsent === true;
    if (wantsSms && !value.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phoneNumber'],
        message: 'A phone number is required to enable SMS notifications',
      });
    }
  });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
