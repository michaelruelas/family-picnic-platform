import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '~/lib/prisma';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { ChargeStatus, RegistrationStatus, RefundStatus } from '~/lib/generated/enums';
import { verifyWebhookSignature, isWebhookConfigured } from '~/lib/stripe';
import { writeAuditLog } from '~/lib/audit';
import { sendRegistrationReceipt } from '~/lib/receipt';

export const dynamic = 'force-dynamic';

type StripeChargeLike = {
  id: string;
  amount?: number;
  amount_captured?: number;
  amount_refunded?: number;
  currency?: string;
  payment_intent?: string;
  receipt_url?: string | null;
};

type StripePaymentIntentLike = {
  id: string;
  amount?: number;
  amount_received?: number;
  currency?: string;
  latest_charge?: string | StripeChargeLike;
  receipt_email?: string | null;
  status?: string;
  last_payment_error?: { code?: string; message?: string } | null;
  metadata?: Record<string, string> | null;
};

type StripeEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const log = createRequestLogger({
    requestId,
    route: '/api/stripe/webhook',
  });

  if (!isWebhookConfigured()) {
    log.warn('Stripe webhook called but STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: StripeEvent;
  try {
    const verified = await verifyWebhookSignature({
      payload: rawBody,
      signatureHeader: signature,
    });
    event = verified;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Stripe webhook signature verification failed',
    );
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as StripePaymentIntentLike, log);
        break;
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await handlePaymentIntentFailed(event.data.object as StripePaymentIntentLike, log);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as StripeChargeLike, log);
        break;
      case 'charge.updated':
        // We only need charge updates when receipt URL becomes available.
        await handleChargeUpdated(event.data.object as StripeChargeLike);
        break;
      default:
        log.debug({ type: event.type, eventId: event.id }, 'Unhandled Stripe event type');
    }
  } catch (err) {
    // The Stripe event was already accepted (signature verified). Any
    // exception here is a downstream bug or transient DB error. Returning
    // 500 makes Stripe retry, which can re-fire the receipt email and
    // write a duplicate `payment.succeeded` audit entry. Return 200 and
    // rely on the per-handler idempotency checks (Charge.status,
    // refundedCents comparison) to keep state correct. We log loudly so
    // operators can investigate.
    log.error(
      {
        err: err instanceof Error ? err.message : String(err),
        type: event.type,
        eventId: event.id,
      },
      'Stripe webhook handler error',
    );
    return NextResponse.json({ received: true, eventId: event.id, error: 'handler' });
  }

  return NextResponse.json({ received: true, eventId: event.id });
}

async function handlePaymentIntentSucceeded(
  intent: StripePaymentIntentLike,
  log: ReturnType<typeof createRequestLogger>,
): Promise<void> {
  const charge = await prisma.charge.findUnique({
    where: { stripePaymentIntentId: intent.id },
    include: {
      registration: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, name: true, date: true } },
        },
      },
    },
  });
  if (!charge) {
    log.warn({ paymentIntentId: intent.id }, 'No charge row for succeeded PaymentIntent');
    return;
  }

  // Retry dedup: if Stripe is replaying a `payment_intent.succeeded` we
  // already processed, skip the receipt send and the audit-log write so
  // we don't double-charge the user's inbox or the admin's audit feed.
  // The `charge.status === SUCCEEDED` check is sufficient: every code
  // path that sets `receiptSentAt` also sets status to SUCCEEDED, so
  // a separate receiptSentAt branch would be redundant.
  if (charge.status === ChargeStatus.SUCCEEDED) {
    log.debug(
      { paymentIntentId: intent.id, chargeId: charge.id },
      'payment_intent.succeeded already handled; skipping',
    );
    return;
  }

  const chargeRow = pickChargeFromIntent(intent);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedCharge = await tx.charge.update({
      where: { id: charge.id },
      data: {
        status: ChargeStatus.SUCCEEDED,
        amountCents: intent.amount_received ?? intent.amount ?? charge.amountCents,
        currency: intent.currency ?? charge.currency,
        receiptUrl: chargeRow?.receipt_url ?? charge.receiptUrl ?? null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    // Status guard: a Stripe retry of payment_intent.succeeded must not
    // resurrect a FORFEITED, REFUNDED, or CANCELLED registration to
    // PAID. The user paid once, then the admin marked it forfeited
    // (no-show) or refunded it — or the user themselves cancelled —
    // and the payment side stays succeeded but the registration
    // reflects the closure. If `updateMany` matches no rows we bail
    // out cleanly.
    const updateResult = await tx.registration.updateMany({
      where: {
        id: charge.registrationId,
        status: {
          notIn: [
            RegistrationStatus.FORFEITED,
            RegistrationStatus.REFUNDED,
            RegistrationStatus.CANCELLED,
          ],
        },
      },
      data: { status: RegistrationStatus.PAID },
    });
    const updatedRegistration =
      updateResult.count === 0
        ? null
        : await tx.registration.findUniqueOrThrow({
            where: { id: charge.registrationId },
          });
    return { updatedCharge, updatedRegistration, resurrected: updateResult.count === 0 };
  });

  if (updated.resurrected) {
    log.info(
      {
        paymentIntentId: intent.id,
        registrationId: charge.registrationId,
        existingStatus: charge.registration.status,
      },
      'payment_intent.succeeded ignored: registration already in terminal state',
    );
    return;
  }

  await writeAuditLog({
    userId: charge.registration.userId,
    eventId: charge.registration.eventId,
    action: 'payment.succeeded',
    oldValue: { chargeStatus: charge.status, registrationStatus: charge.registration.status },
    newValue: {
      chargeStatus: updated.updatedCharge.status,
      registrationStatus: updated.updatedRegistration!.status,
      paymentIntentId: intent.id,
      amountCents: updated.updatedCharge.amountCents,
    },
  });

  // Best-effort receipt. Failure does not fail the webhook; the admin
  // can resend via the admin charges page. The early return above
  // (when charge.status === SUCCEEDED) prevents re-mailing on retries.
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const receipt = await sendRegistrationReceipt({
    to: charge.registration.user.email,
    userName: charge.registration.user.name,
    eventName: charge.registration.event.name,
    eventDate: charge.registration.event.date,
    amountCents: updated.updatedCharge.amountCents,
    currency: updated.updatedCharge.currency,
    chargeId: charge.id,
    registrationId: charge.registrationId,
    receiptUrl: updated.updatedCharge.receiptUrl,
    eventUrl: `${baseUrl}/events/${charge.registration.eventId}`,
  });

  if (receipt.success) {
    await prisma.charge.update({
      where: { id: charge.id },
      data: { receiptSentAt: new Date() },
    });
  } else {
    log.warn(
      { chargeId: charge.id, error: receipt.error },
      'Receipt email failed; admin can resend',
    );
  }
}

async function handlePaymentIntentFailed(
  intent: StripePaymentIntentLike,
  log: ReturnType<typeof createRequestLogger>,
): Promise<void> {
  const charge = await prisma.charge.findUnique({
    where: { stripePaymentIntentId: intent.id },
    include: { registration: true },
  });
  if (!charge) {
    log.warn({ paymentIntentId: intent.id }, 'No charge row for failed PaymentIntent');
    return;
  }
  // Retry dedup: already terminal, skip the redundant audit write.
  if (charge.status === ChargeStatus.FAILED || charge.status === ChargeStatus.CANCELED) {
    return;
  }
  const newStatus = intent.status === 'canceled' ? ChargeStatus.CANCELED : ChargeStatus.FAILED;

  await prisma.charge.update({
    where: { id: charge.id },
    data: {
      status: newStatus,
      lastErrorCode: intent.last_payment_error?.code ?? null,
      lastErrorMessage: intent.last_payment_error?.message ?? null,
    },
  });

  await writeAuditLog({
    userId: charge.registration.userId,
    eventId: charge.registration.eventId,
    action: 'payment.failed',
    oldValue: { chargeStatus: charge.status },
    newValue: {
      chargeStatus: newStatus,
      errorCode: intent.last_payment_error?.code ?? null,
      errorMessage: intent.last_payment_error?.message ?? null,
    },
  });
}
/**
 * Reads the in-app refund rows for `chargeId`, applies the
 * `max(stripe, local-with-pending)` formula, and writes the resulting
 * `refundedCents` plus a full-refund status flip to the registration.
 *
 * Both `charge.refunded` (full refunds) and `charge.updated` (partial
 * refunds) feed into this so the formula stays in one place. Returns
 * the pre/post values the caller needs to build an audit entry, or
 * `null` when nothing actually changed and an audit write would just
 * be noise.
 */
async function reconcileRefundedAmount(
  chargeId: string,
  registrationId: string,
  chargeAmountCents: number,
  stripeRefundedCents: number,
): Promise<{
  previous: { refundedCents: number; status: RegistrationStatus };
  next: { refundedCents: number; status: RegistrationStatus };
  localRefundedCents: number;
  isFullRefund: boolean;
  changed: boolean;
} | null> {
  const localRefundedCents = (
    await prisma.refund.findMany({
      where: {
        chargeId,
        status: { in: [RefundStatus.SUCCEEDED, RefundStatus.PENDING] },
      },
    })
  ).reduce((sum, r) => sum + r.amountCents, 0);
  const target = Math.max(stripeRefundedCents, localRefundedCents);
  const isFullRefund = target >= chargeAmountCents;
  const nextStatus = isFullRefund ? RegistrationStatus.REFUNDED : null;

  const previous = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: { refundedCents: true, status: true },
  });

  const updateResult = await prisma.registration.updateMany({
    where: { id: registrationId },
    data: {
      refundedCents: target,
      ...(nextStatus ? { status: nextStatus } : {}),
    },
  });
  if (updateResult.count === 0) return null;

  const next = {
    refundedCents: target,
    status: nextStatus ?? previous.status,
  };
  const changed = next.refundedCents !== previous.refundedCents || next.status !== previous.status;
  return { previous, next, localRefundedCents, isFullRefund, changed };
}

async function handleChargeRefunded(
  charge: StripeChargeLike,
  log: ReturnType<typeof createRequestLogger>,
): Promise<void> {
  // Stripe may send charge.refunded with payment_intent id; the safest
  // match is by Stripe charge id via a stored PaymentIntent lookup.
  if (!charge.payment_intent) {
    log.warn({ chargeId: charge.id }, 'charge.refunded without payment_intent');
    return;
  }
  const localCharge = await prisma.charge.findUnique({
    where: { stripePaymentIntentId: charge.payment_intent },
    include: {
      registration: {
        select: { id: true, eventId: true, userId: true },
      },
    },
  });
  if (!localCharge || !localCharge.registration) {
    log.warn(
      { chargeId: charge.id, paymentIntent: charge.payment_intent },
      'No local charge for charge.refunded',
    );
    return;
  }

  // Stripe is the authoritative source of the cumulative refunded
  // amount. Local Refund rows capture in-app refunds issued via
  // `admin.refund`; refunds issued from the Stripe dashboard do not
  // produce a local row. We count both SUCCEEDED and PENDING rows in
  // the local sum to close the race with admin.refund's in-flight
  // transaction. The reconciliation formula lives in
  // `reconcileRefundedAmount` so the two event handlers stay in sync.
  const stripeRefundedCents = charge.amount_refunded ?? 0;
  const reconciled = await reconcileRefundedAmount(
    localCharge.id,
    localCharge.registrationId,
    localCharge.amountCents,
    stripeRefundedCents,
  );
  if (!reconciled) return;

  await writeAuditLog({
    userId: localCharge.registration.userId,
    eventId: localCharge.registration.eventId,
    action: 'payment.refundReconciled',
    oldValue: {
      refundedCents: reconciled.previous.refundedCents,
      registrationStatus: reconciled.previous.status,
    },
    newValue: {
      refundedCents: reconciled.next.refundedCents,
      registrationStatus: reconciled.next.status,
      isFullRefund: reconciled.isFullRefund,
      stripeRefundedCents,
      localRefundedCents: reconciled.localRefundedCents,
      source: stripeRefundedCents > reconciled.localRefundedCents ? 'out_of_band' : 'in_app',
    },
  });

  if (stripeRefundedCents > reconciled.localRefundedCents) {
    log.info(
      {
        chargeId: localCharge.id,
        localRefundedCents: reconciled.localRefundedCents,
        stripeRefundedCents,
        delta: stripeRefundedCents - reconciled.localRefundedCents,
      },
      'Out-of-band refund detected via Stripe dashboard',
    );
  }
}

async function handleChargeUpdated(charge: StripeChargeLike): Promise<void> {
  // Stripe fires `charge.updated` for partial refunds (only full refunds
  // produce `charge.refunded`). Without this branch, a partial
  // out-of-band refund would leave `refundedCents` stale while the
  // admin UI expects it to match Stripe. Reconciliation uses the same
  // `max(stripe, local-with-pending)` formula as `charge.refunded` so
  // the two paths agree.
  if (!charge.payment_intent) return;
  const localCharge = await prisma.charge.findUnique({
    where: { stripePaymentIntentId: charge.payment_intent },
    select: { id: true, amountCents: true, registrationId: true, receiptUrl: true },
  });
  if (!localCharge) return;

  if (!localCharge.receiptUrl && charge.receipt_url) {
    await prisma.charge.update({
      where: { id: localCharge.id },
      data: { receiptUrl: charge.receipt_url },
    });
  }

  const stripeRefundedCents = charge.amount_refunded ?? 0;
  if (stripeRefundedCents <= 0) return;

  // For the audit log we need eventId / userId. The reconciliation
  // helper handles the refundedCents + status math; we fetch the
  // identity fields only on a real change to avoid a needless round
  // trip on idempotent retries.
  const reconciled = await reconcileRefundedAmount(
    localCharge.id,
    localCharge.registrationId,
    localCharge.amountCents,
    stripeRefundedCents,
  );
  if (!reconciled || !reconciled.changed) return;

  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: localCharge.registrationId },
    select: { userId: true, eventId: true },
  });

  await writeAuditLog({
    userId: registration.userId,
    eventId: registration.eventId,
    action: 'payment.refundReconciled',
    oldValue: {
      refundedCents: reconciled.previous.refundedCents,
      registrationStatus: reconciled.previous.status,
    },
    newValue: {
      refundedCents: reconciled.next.refundedCents,
      registrationStatus: reconciled.next.status,
      isFullRefund: reconciled.isFullRefund,
      stripeRefundedCents,
      localRefundedCents: reconciled.localRefundedCents,
      source: stripeRefundedCents > reconciled.localRefundedCents ? 'out_of_band' : 'in_app',
    },
  });
}

function pickChargeFromIntent(intent: StripePaymentIntentLike): StripeChargeLike | null {
  const latest = intent.latest_charge;
  if (!latest) return null;
  if (typeof latest === 'string') {
    return { id: latest };
  }
  return latest;
}
