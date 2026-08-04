import { z } from 'zod';

export const e164Schema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g. +15551234567)');

export const adminSendSmsInputSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  recipientUserId: z.string().min(1, 'recipientUserId is required'),
  message: z
    .string()
    .trim()
    .min(1, 'message is required')
    .max(1600, 'message exceeds 1600 character SMS limit'),
});

export type AdminSendSmsInput = z.infer<typeof adminSendSmsInputSchema>;

type SmsOptIn = {
  communicationPreference?: 'EMAIL' | 'SMS' | 'BOTH' | 'NONE';
  phoneNumber?: string | null;
  smsConsent?: boolean;
};

export function requirePhoneIfWantsSms(value: SmsOptIn, ctx: z.RefinementCtx): void {
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
}
