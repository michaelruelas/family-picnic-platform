import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, procedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { ChargeStatus, EventStatus, RegistrationStatus } from '~/lib/generated/enums';
import { writeAuditLog } from '~/lib/audit';
import {
  createPaymentIntent,
  getPublishableKey,
  isConfigured as stripeConfigured,
} from '~/lib/stripe';
import { createPaymentIntentInputSchema } from '~/lib/schemas/payment';

const ACTIVE_CHARGE_STATUSES: ChargeStatus[] = [
  ChargeStatus.REQUIRES_PAYMENT_METHOD,
  ChargeStatus.REQUIRES_CONFIRMATION,
  ChargeStatus.REQUIRES_ACTION,
  ChargeStatus.PROCESSING,
  ChargeStatus.REQUIRES_CAPTURE,
];

export const paymentRouter = router({
  /**
   * Returns the Stripe publishable key (client-side safe). Used by the
   * checkout page server component to seed the Stripe.js loader. Returns
   * null when Stripe is not configured, so the UI can hide the pay flow.
   */
  getPublishableKey: procedure.query(() => {
    if (!stripeConfigured()) return { publishableKey: null };
    return { publishableKey: getPublishableKey() };
  }),

  /**
   * Idempotently creates (or reuses) a Registration and a Stripe
   * PaymentIntent for the caller against the given event. Returns the
   * client_secret that the browser-side Payment Element needs.
   */
  createPaymentIntent: protectedProcedure
    .input(createPaymentIntentInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!stripeConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Payments are not configured for this environment',
        });
      }

      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: {
          id: true,
          name: true,
          status: true,
          registrationFeeCents: true,
          currency: true,
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }
      if (event.status !== EventStatus.PUBLISHED) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Event is not accepting registrations',
        });
      }
      const fee = event.registrationFeeCents ?? 0;
      if (fee <= 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Event does not require payment',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { id: true, email: true, name: true, householdId: true },
      });
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const registration = await prisma.$transaction(async (tx) => {
        const existing = await tx.registration.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: user.id } },
          include: {
            charges: { orderBy: { createdAt: 'desc' } },
          },
        });

        if (existing?.status === RegistrationStatus.PAID) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'You are already registered for this event',
          });
        }
        if (
          existing &&
          (existing.status === RegistrationStatus.REFUNDED ||
            existing.status === RegistrationStatus.FORFEITED ||
            existing.status === RegistrationStatus.CANCELLED)
        ) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Your previous registration was closed; contact an admin to re-register',
          });
        }

        const activeCharge = existing?.charges.find((c) =>
          ACTIVE_CHARGE_STATUSES.includes(c.status),
        );
        if (existing && activeCharge) {
          return existing;
        }

        const registrationRow =
          existing ??
          (await tx.registration.create({
            data: {
              eventId: event.id,
              userId: user.id,
              householdId: user.householdId,
              amountCents: fee,
              currency: event.currency,
              status: RegistrationStatus.PENDING,
            },
          }));

        if (!activeCharge) {
          await tx.charge.create({
            data: {
              registrationId: registrationRow.id,
              stripePaymentIntentId: `pending_${registrationRow.id}_${Date.now()}`,
              amountCents: fee,
              currency: event.currency,
              status: ChargeStatus.REQUIRES_PAYMENT_METHOD,
            },
          });
        }
        return registrationRow;
      });

      // Re-read with the latest charge attached.
      const fresh = await prisma.registration.findUniqueOrThrow({
        where: { id: registration.id },
        include: { charges: { orderBy: { createdAt: 'desc' } } },
      });

      const activeCharge =
        fresh.charges.find((c) => ACTIVE_CHARGE_STATUSES.includes(c.status)) ?? fresh.charges[0];
      if (!activeCharge) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Charge not found' });
      }

      let intent: Awaited<ReturnType<typeof createPaymentIntent>>;
      try {
        intent = await createPaymentIntent({
          amountCents: activeCharge.amountCents,
          currency: activeCharge.currency,
          idempotencyKey: activeCharge.id,
          metadata: {
            registrationId: registration.id,
            chargeId: activeCharge.id,
            eventId: event.id,
            userId: user.id,
          },
          receiptEmail: user.email,
          description: `Registration: ${event.name}`,
        });
      } catch (err) {
        await prisma.charge.update({
          where: { id: activeCharge.id },
          data: {
            status: ChargeStatus.FAILED,
            lastErrorCode: 'CREATE_INTENT_FAILED',
            lastErrorMessage: err instanceof Error ? err.message : String(err),
          },
        });
        await writeAuditLog({
          userId: user.id,
          eventId: event.id,
          action: 'payment.intentFailed',
          newValue: {
            chargeId: activeCharge.id,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create payment intent',
        });
      }

      const updated = await prisma.charge.update({
        where: { id: activeCharge.id },
        data: {
          stripePaymentIntentId: intent.paymentIntentId,
          status: mapStripeIntentStatusToChargeStatus(intent.status),
        },
      });

      await writeAuditLog({
        userId: user.id,
        eventId: event.id,
        action: 'payment.intentCreated',
        newValue: {
          registrationId: registration.id,
          chargeId: updated.id,
          paymentIntentId: intent.paymentIntentId,
          amountCents: intent.amountCents,
          currency: intent.currency,
        },
      });

      return {
        registrationId: registration.id,
        chargeId: updated.id,
        paymentIntentId: intent.paymentIntentId,
        clientSecret: intent.clientSecret,
        status: updated.status,
        amountCents: intent.amountCents,
        currency: intent.currency,
        publishableKey: getPublishableKey(),
      };
    }),

  /**
   * Returns the caller's registration for the event with all charges and
   * refunds, used by the checkout page to render the current state. Null
   * when the user has not yet started registration.
   */
  getMyRegistration: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const registration = await prisma.registration.findUnique({
        where: { eventId_userId: { eventId: input.eventId, userId: ctx.session.user.id } },
        include: {
          charges: { orderBy: { createdAt: 'desc' } },
          refunds: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!registration) return null;

      return {
        id: registration.id,
        status: registration.status,
        amountCents: registration.amountCents,
        refundedCents: registration.refundedCents,
        currency: registration.currency,
        receiptSentAt: registration.receiptSentAt,
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt,
        charges: registration.charges.map((c) => ({
          id: c.id,
          status: c.status,
          amountCents: c.amountCents,
          receiptUrl: c.receiptUrl,
          createdAt: c.createdAt,
        })),
        refunds: registration.refunds.map((r) => ({
          id: r.id,
          amountCents: r.amountCents,
          status: r.status,
          reason: r.reason,
          createdAt: r.createdAt,
        })),
      };
    }),
});

function mapStripeIntentStatusToChargeStatus(status: string): ChargeStatus {
  switch (status) {
    case 'requires_payment_method':
      return ChargeStatus.REQUIRES_PAYMENT_METHOD;
    case 'requires_confirmation':
      return ChargeStatus.REQUIRES_CONFIRMATION;
    case 'requires_action':
      return ChargeStatus.REQUIRES_ACTION;
    case 'processing':
      return ChargeStatus.PROCESSING;
    case 'requires_capture':
      return ChargeStatus.REQUIRES_CAPTURE;
    case 'succeeded':
      return ChargeStatus.SUCCEEDED;
    case 'canceled':
      return ChargeStatus.CANCELED;
    default:
      return ChargeStatus.FAILED;
  }
}
