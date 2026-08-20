import { z } from 'zod';

export const potluckSlotTypeSchema = z.enum(['LIMITED', 'UNLIMITED']);

/**
 * Multi-claim per RSVP: a household can sign up multiple times on the
 * same slot with different dish names (e.g. "Other: Cups" and "Other:
 * Napkins"). Each signup is uniquely identified by its `id`.
 *
 * `potluckSignupInputSchema` validates the create path (by `slotId`).
 * Edits target a specific signup via `potluckUpdateSignupInputSchema`.
 * Cancellations use `potluckCancelSignupInputSchema`. The legacy
 * `potluckSignupSchema` (single-shape with `action: 'signup' | 'cancel'`)
 * remains for the REST route, which still accepts the discriminated
 * shape but now routes cancel through `signupId`.
 */
export const potluckSignupInputSchema = z.object({
  slotId: z.string().min(1, 'Slot ID is required'),
  dishName: z.string().trim().max(80, 'Dish name is too long').default(''),
  servings: z.number().int().min(1).default(1),
  dietaryLabels: z.array(z.string()).default([]),
});

export const potluckUpdateSignupInputSchema = z.object({
  signupId: z.string().min(1, 'Signup ID is required'),
  dishName: z.string().trim().max(80, 'Dish name is too long').default(''),
  servings: z.number().int().min(1).default(1),
  dietaryLabels: z.array(z.string()).default([]),
});

export const potluckCancelSignupInputSchema = z.object({
  signupId: z.string().min(1, 'Signup ID is required'),
});

/**
 * Admin signup input schemas. The diner-facing `updateSignup` /
 * `cancelSignup` / `signup` procedures require the caller's own
 * RSVP; the admin variants below accept any RSVP / slot under the
 * event and are gated by `eventAdminProcedure` upstream.
 */
export const adminListPotluckSignupsInputSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
});

export const adminUpdatePotluckSignupInputSchema = z.object({
  signupId: z.string().min(1, 'Signup ID is required'),
  dishName: z.string().trim().max(80, 'Dish name is too long').default(''),
  servings: z.number().int().min(1),
  dietaryLabels: z.array(z.string()),
});

export const adminCancelPotluckSignupInputSchema = z.object({
  signupId: z.string().min(1, 'Signup ID is required'),
});

export const adminCreatePotluckSignupInputSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  slotId: z.string().min(1, 'Slot ID is required'),
  rsvpId: z.string().min(1, 'RSVP ID is required'),
  dishName: z.string().trim().max(80, 'Dish name is too long').default(''),
  servings: z.number().int().min(1).default(1),
  dietaryLabels: z.array(z.string()).default([]),
});

export const adminReassignPotluckSignupInputSchema = z.object({
  signupId: z.string().min(1, 'Signup ID is required'),
  slotId: z.string().min(1, 'Slot ID is required'),
  rsvpId: z.string().min(1, 'RSVP ID is required'),
});

/**
 * Legacy REST shape. The `action` discriminator routes between the
 * three procedures. `signup` uses `slotId`; `cancel` uses `signupId`.
 * Kept exported because `/api/potluck-signup` validates against it.
 */
export const potluckSignupSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('signup'),
    slotId: z.string().min(1, 'Slot ID is required'),
    dishName: z.string().max(80, 'Dish name is too long').optional(),
    servings: z.number().int().min(1).default(1).optional(),
    dietaryLabels: z.array(z.string()).default([]).optional(),
  }),
  z.object({
    action: z.literal('cancel'),
    signupId: z.string().min(1, 'Signup ID is required'),
  }),
]);

export type PotluckSignupInput = z.infer<typeof potluckSignupInputSchema>;
export type PotluckUpdateSignupInput = z.infer<typeof potluckUpdateSignupInputSchema>;
export type PotluckCancelSignupInput = z.infer<typeof potluckCancelSignupInputSchema>;
export type AdminUpdatePotluckSignupInput = z.infer<typeof adminUpdatePotluckSignupInputSchema>;
export type AdminCancelPotluckSignupInput = z.infer<typeof adminCancelPotluckSignupInputSchema>;
export type AdminCreatePotluckSignupInput = z.infer<typeof adminCreatePotluckSignupInputSchema>;
export type AdminReassignPotluckSignupInput = z.infer<typeof adminReassignPotluckSignupInputSchema>;
