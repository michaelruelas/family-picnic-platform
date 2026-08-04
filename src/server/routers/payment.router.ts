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
import { withSerializableRetry } from '~/lib/transaction-retry';
import type { PrismaClient } from '~/lib/generated/client';

// Serializable isolation is required for createPaymentIntent: two near-
// simultaneous calls from the same user must not both pass the
// "existing && activeCharge" check, each create a new Charge, and each
// issue a fresh PaymentIntent on Stripe. Postgres' Serializable
// aborts one of the conflicting transactions with a serialization
// failure (P2034); the procedure body is wrapped in
// withSerializableRetry so the loser retries cleanly. Stripe's
// idempotencyKey on the PaymentIntent call ensures the retry does
// not create a duplicate intent.
type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

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
   *
   * Concurrency: the inner function runs inside `withSerializableRetry`
   * because the find-or-create transaction uses Postgres Serializable
   * isolation. Concurrent callers may abort each other with P2034; the
   * retry then re-runs the procedure. Stripe's idempotencyKey on the
   * PaymentIntent call (== charge.id) ensures a retry cannot create a
   * duplicate intent — Stripe returns the existing one.
   */
  createPaymentIntent: protectedProcedure
    .input(createPaymentIntentInputSchema)
    .mutation(async ({ ctx, input }) => {
      return withSerializableRetry(() =>
        createPaymentIntentInner(ctx, input, prisma, stripeConfigured),
      );
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
        // True when the most recent charge has had its receipt emailed.
        receiptSent: registration.charges.some((c) => c.receiptSentAt !== null),
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

/**
 * Extracted body of `payment.createPaymentIntent` so the retry wrapper
 * can re-invoke it on a Postgres serialization failure without losing
 * closure over the prisma client.
 */
async function createPaymentIntentInner(
  ctx: { session: { user: { id: string } } },
  input: { eventId: string },
  prismaClient: typeof prisma,
  isStripeConfigured: () => boolean,
) {
  if (!isStripeConfigured()) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Payments are not configured for this environment',
    });
  }

  const event = await prismaClient.event.findUnique({
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

  const user = await prismaClient.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { id: true, email: true, name: true, householdId: true },
  });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  }

  // Serializable isolation so concurrent calls from the same user
  // cannot both pass the "existing && activeCharge" check and each
  // create a fresh Charge + PaymentIntent. Postgres aborts the loser
  // with P2034; the outer withSerializableRetry then re-runs the
  // whole body.
  const { registration, charge } = await prismaClient.$transaction(
    async (tx) => findOrCreateActiveCharge(tx, event.id, user, fee, event.currency),
    { isolationLevel: 'Serializable' },
  );

  let intent: Awaited<ReturnType<typeof createPaymentIntent>>;
  try {
    intent = await createPaymentIntent({
      amountCents: charge.amountCents,
      currency: charge.currency,
      idempotencyKey: charge.id,
      metadata: {
        registrationId: registration.id,
        chargeId: charge.id,
        eventId: event.id,
        userId: user.id,
      },
      receiptEmail: user.email,
      description: `Registration: ${event.name}`,
    });
  } catch (err) {
    await prismaClient.charge.update({
      where: { id: charge.id },
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
        chargeId: charge.id,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create payment intent',
    });
  }

  const updated = await prismaClient.charge.update({
    where: { id: charge.id },
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
}

type FindOrCreateInput = {
  id: string;
  email: string;
  householdId: string | null;
};

async function findOrCreateActiveCharge(
  tx: Tx,
  eventId: string,
  user: FindOrCreateInput,
  fee: number,
  currency: string,
): Promise<{
  registration: { id: string };
  charge: { id: string; amountCents: number; currency: string };
}> {
  const existing = await tx.registration.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
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
    return {
      registration: { id: existing.id },
      charge: {
        id: activeCharge.id,
        amountCents: activeCharge.amountCents,
        currency: activeCharge.currency,
      },
    };
  }

  const registrationRow =
    existing ??
    (await tx.registration.create({
      data: {
        eventId,
        userId: user.id,
        householdId: user.householdId,
        amountCents: fee,
        currency,
        status: RegistrationStatus.PENDING,
      },
    }));

  const newCharge = activeCharge
    ? null
    : await tx.charge.create({
        data: {
          registrationId: registrationRow.id,
          stripePaymentIntentId: `pending_${registrationRow.id}_${Date.now()}`,
          amountCents: fee,
          currency,
          status: ChargeStatus.REQUIRES_PAYMENT_METHOD,
        },
      });

  // One of the two paths above always produces a charge; the type guard
  // makes TypeScript happy.
  const chargeRow = activeCharge ?? newCharge;
  if (!chargeRow) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Charge not found' });
  }

  return {
    registration: { id: registrationRow.id },
    charge: {
      id: chargeRow.id,
      amountCents: chargeRow.amountCents,
      currency: chargeRow.currency,
    },
  };
}
