import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, procedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import {
  ChargeStatus,
  EventStatus,
  RegistrationStatus,
  RsvpAttending,
} from '~/lib/generated/enums';
import { writeAuditLog } from '~/lib/audit';
import {
  createPaymentIntent,
  getPublishableKey,
  getStripeClient,
  isConfigured as stripeConfigured,
} from '~/lib/stripe';
import { createPaymentIntentInputSchema, payLaterInputSchema } from '~/lib/schemas/payment';
import { withSerializableRetry } from '~/lib/transaction-retry';
import { calculateFeeFromEvent, type FeeAttendee } from '~/lib/fee';
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

/**
 * Stripe considers `succeeded` and `canceled` terminal; `requires_payment_method`
 * after Stripe-side cancellation also falls into this bucket. When we hand a
 * PaymentIntent in one of these states back to `<Elements>` it throws
 * "This PaymentIntent is in a terminal state and cannot be used to
 * initialize Elements".
 */
function isTerminalIntentStatus(status: string | null | undefined): boolean {
  return status === 'succeeded' || status === 'canceled';
}

/**
 * Reconcile a local Charge whose Stripe side has moved to a terminal
 * state. Stripe's idempotency cache returns the original intent for 24
 * hours even after it has since been paid or canceled, so blindly
 * returning the cached client_secret mounts `<Elements>` against a
 * terminal intent and Stripe.js throws. We can't recover the intent,
 * but we can sync the local row to Stripe's truth so the next caller
 * takes the "create a fresh charge" branch.
 */
async function syncChargeToTerminalState(
  prismaClient: typeof prisma,
  chargeId: string,
  stripeStatus: string,
  lastErrorCode: string | null,
  lastErrorMessage: string | null,
): Promise<void> {
  await prismaClient.charge.update({
    where: { id: chargeId },
    data: {
      status: mapStripeIntentStatusToChargeStatus(stripeStatus),
      lastErrorCode,
      lastErrorMessage,
    },
  });
}

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

  /**
   * Marks the caller's registration for an event as deferred to
   * "pay later". Idempotent: re-running it on an already-pending
   * registration is a no-op (returns the existing record). The status
   * stays PENDING so the existing checkout, admin refund, and forfeit
   * flows continue to handle the row consistently. Only the caller's
   * own registration is touched, and only when the event still
   * expects a fee — a zero amount means there is nothing to collect
   * and we no-op.
   */
  payLater: protectedProcedure.input(payLaterInputSchema).mutation(async ({ ctx, input }) => {
    const registration = await prisma.registration.findUnique({
      where: {
        eventId_userId: { eventId: input.eventId, userId: ctx.session.user.id },
      },
      select: {
        id: true,
        status: true,
        amountCents: true,
        currency: true,
      },
    });

    if (!registration || registration.amountCents <= 0) {
      return { changed: false, status: registration?.status ?? RegistrationStatus.PENDING };
    }

    if (
      registration.status === RegistrationStatus.PAID ||
      registration.status === RegistrationStatus.REFUNDED ||
      registration.status === RegistrationStatus.FORFEITED ||
      registration.status === RegistrationStatus.CANCELLED
    ) {
      return { changed: false, status: registration.status };
    }

    // Cancel any in-flight charges so a later Pay Now attempt builds a
    // fresh intent; the registration stays PENDING.
    await prisma.charge.updateMany({
      where: {
        registrationId: registration.id,
        status: { in: ACTIVE_CHARGE_STATUSES },
      },
      data: { status: ChargeStatus.CANCELED },
    });

    return { changed: true, status: RegistrationStatus.PENDING };
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
  //
  // Pre-flight: any active charge with a Stripe-side terminal intent
  // (succeeded / canceled via dashboard, webhook failure, or out-of-
  // band refund) must be synced *before* the transaction so the
  // `existing && activeCharge` check below skips it. We deliberately
  // run this outside the Serializable tx — calling Stripe holds an
  // HTTP request, not a Postgres row lock — and only touch rows that
  // are already considered "active" in our DB.
  const registrationPre = await prismaClient.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    select: {
      id: true,
      charges: {
        where: { status: { in: ACTIVE_CHARGE_STATUSES } },
        select: {
          id: true,
          stripePaymentIntentId: true,
        },
      },
    },
  });
  if (registrationPre) {
    await reconcileStaleChargesWithStripe(
      prismaClient,
      registrationPre.charges,
      user.id,
      event.id,
      getStripeClient,
    );
  }

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

  const activeCharge = existing?.charges.find((c) => ACTIVE_CHARGE_STATUSES.includes(c.status));
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

/**
 * Walks every "active" charge on a registration and asks Stripe whether
 * the underlying PaymentIntent has since moved to a terminal state.
 * Out-of-band payments (Stripe dashboard, terminal on the user's side
 * with a delayed webhook) or canceled-via-dashboard intents land in
 * our DB as `REQUIRES_PAYMENT_METHOD` until the webhook catches up,
 * but Stripe will still hand us a cached client_secret for them.
 * Mounting `<Elements>` against that secret is the production cause of
 * "This PaymentIntent is in a terminal state and cannot be used to
 * initialize Elements".
 *
 * Each stale charge is updated in place so the transaction below sees
 * a clean slate and routes the caller through the "create a fresh
 * charge" branch. We never *use* a stale client_secret here — this
 * helper only flips the local row to its terminal status and returns.
 */
async function reconcileStaleChargesWithStripe(
  prismaClient: typeof prisma,
  activeCharges: Array<{ id: string; stripePaymentIntentId: string }>,
  userId: string,
  eventId: string,
  getClient: typeof getStripeClient,
): Promise<void> {
  if (activeCharges.length === 0) return;
  const stripe = getClient();
  for (const charge of activeCharges) {
    const piid = charge.stripePaymentIntentId;
    // Skip the placeholder we persist until Stripe hands us a real
    // id — there's nothing to retrieve on Stripe's side yet, and the
    // audit log is the source of truth for the eventual replace.
    if (!piid || !piid.startsWith('pi_')) continue;
    try {
      const intent = await stripe.paymentIntents.retrieve(piid);
      if (isTerminalIntentStatus(intent.status)) {
        await syncChargeToTerminalState(
          prismaClient,
          charge.id,
          intent.status,
          intent.last_payment_error?.code ?? null,
          intent.last_payment_error?.message ?? null,
        );
      }
    } catch (err) {
      // Don't fail the caller if Stripe is unreachable — the
      // consistent read in findOrCreateActiveCharge will surface the
      // stale charge, and the resulting clientSecret will at worst
      // look identical to the previous one (Stripe idempotency
      // cache) so the user sees the same Stripe Element they had
      // before. Surface the error in the audit log so operators
      // can spot the drift on the next deploy.
      await writeAuditLog({
        userId,
        eventId,
        action: 'payment.intentReconcileFailed',
        newValue: {
          chargeId: charge.id,
          paymentIntentId: piid,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}
