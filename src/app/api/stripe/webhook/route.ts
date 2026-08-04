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
  latest_charge?: string | string | StripeChargeLike;
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
    const updatedRegistration = await tx.registration.update({
      where: { id: charge.registrationId },
      data: { status: RegistrationStatus.PAID },
    });
    return { updatedCharge, updatedRegistration };
  });

  await writeAuditLog({
    userId: charge.registration.userId,
    eventId: charge.registration.eventId,
    action: 'payment.succeeded',
    oldValue: { chargeStatus: charge.status, registrationStatus: charge.registration.status },
    newValue: {
      chargeStatus: updated.updatedCharge.status,
      registrationStatus: updated.updatedRegistration.status,
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
  const newStatus =
    intent.status === 'canceled' ? ChargeStatus.CANCELED : ChargeStatus.FAILED;

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
  });
  if (!localCharge) {
    log.warn(
      { chargeId: charge.id, paymentIntent: charge.payment_intent },
      'No local charge for charge.refunded',
    );
    return;
  }

  // Stripe is the authoritative source of the cumulative refunded
  // amount. Local Refund rows only capture in-app refunds issued via
  // `admin.refund`; refunds issued from the Stripe dashboard do not
  // produce a local row. If we trusted the local sum alone, an
  // out-of-band refund would wipe `refundedCents` back to the in-app
  // total, hiding the dashboard refund from the admin UI.
  const localRefundedCents = (
    await prisma.refund.findMany({
      where: { chargeId: localCharge.id, status: RefundStatus.SUCCEEDED },
    })
  ).reduce((sum, r) => sum + r.amountCents, 0);
  const stripeRefundedCents = charge.amount_refunded ?? 0;
  const totalRefunded = Math.max(stripeRefundedCents, localRefundedCents);
  const isFullRefund = totalRefunded >= localCharge.amountCents;

  await prisma.registration.update({
    where: { id: localCharge.registrationId },
    data: {
      refundedCents: totalRefunded,
      ...(isFullRefund ? { status: RegistrationStatus.REFUNDED } : {}),
    },
  });

  if (stripeRefundedCents > localRefundedCents) {
    log.info(
      {
        chargeId: localCharge.id,
        localRefundedCents,
        stripeRefundedCents,
        delta: stripeRefundedCents - localRefundedCents,
      },
      'Out-of-band refund detected via Stripe dashboard',
    );
  }
}

async function handleChargeUpdated(charge: StripeChargeLike): Promise<void> {
  if (!charge.payment_intent) return;
  const localCharge = await prisma.charge.findUnique({
    where: { stripePaymentIntentId: charge.payment_intent },
    select: { id: true, receiptUrl: true },
  });
  if (!localCharge) return;
  if (localCharge.receiptUrl) return;
  if (!charge.receipt_url) return;
  await prisma.charge.update({
    where: { id: localCharge.id },
    data: { receiptUrl: charge.receipt_url },
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
