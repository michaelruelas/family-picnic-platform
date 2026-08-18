import { z } from 'zod';
import { ChargeStatus, RefundStatus } from '~/lib/generated/enums';

export const createPaymentIntentInputSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentInputSchema>;

export const payLaterInputSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
});

export type PayLaterInput = z.infer<typeof payLaterInputSchema>;

export const paymentIntentResponseSchema = z.object({
  registrationId: z.string(),
  chargeId: z.string(),
  paymentIntentId: z.string(),
  clientSecret: z.string(),
  status: z.nativeEnum(ChargeStatus),
  amountCents: z.number().int().nonnegative(),
  currency: z.string(),
  publishableKey: z.string(),
});

export type PaymentIntentResponse = z.infer<typeof paymentIntentResponseSchema>;

export const refundInputSchema = z.object({
  chargeId: z.string().min(1, 'Charge ID is required'),
  // null amount = refund the unrefunded balance (full). Provide a positive
  // integer for a partial refund. Must be at most the unrefunded balance;
  // the router enforces the actual bound.
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

export type RefundInput = z.infer<typeof refundInputSchema>;

export const forfeitInputSchema = z.object({
  registrationId: z.string().min(1, 'Registration ID is required'),
  reason: z.string().max(500).optional(),
});

export type ForfeitInput = z.infer<typeof forfeitInputSchema>;

export const listChargesInputSchema = z
  .object({
    eventId: z.string().min(1).optional(),
    status: z.nativeEnum(ChargeStatus).optional(),
  })
  .optional();

export type ListChargesInput = z.infer<typeof listChargesInputSchema>;

export const chargeRowSchema = z.object({
  id: z.string(),
  registrationId: z.string(),
  stripePaymentIntentId: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  status: z.nativeEnum(ChargeStatus),
  receiptUrl: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  registration: z.object({
    id: z.string(),
    status: z.string(),
    refundedCents: z.number().int(),
    user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    event: z.object({ id: z.string(), name: z.string(), date: z.date() }),
  }),
  refunds: z.array(
    z.object({
      id: z.string(),
      amountCents: z.number().int(),
      status: z.nativeEnum(RefundStatus),
      reason: z.string().nullable(),
      createdAt: z.date(),
      refundedBy: z.object({ id: z.string(), name: z.string() }),
    }),
  ),
});

export type ChargeRow = z.infer<typeof chargeRowSchema>;
