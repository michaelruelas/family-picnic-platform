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
    // 500 makes Stripe retry. We have already accepted the event but
    // failed to process it. Idempotency on event.id would be better;
    // for now we log and acknowledge to avoid tight retry loops on bugs.
    log.error(
      {
        err: err instanceof Error ? err.message : String(err),
        type: event.type,
        eventId: event.id,
      },
      'Stripe webhook handler error',
    );
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
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
  // can resend via the admin charges page.
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
  // The admin refund path already updates Refund + Registration. This
  // handler exists for refunds that happen out-of-band in the Stripe
  // dashboard; we sync the amounts here.
  const succeededRefunds = await prisma.refund.findMany({
    where: {
      chargeId: localCharge.id,
      status: RefundStatus.SUCCEEDED,
    },
  });
  const totalRefunded = succeededRefunds.reduce((sum, r) => sum + r.amountCents, 0);
  const isFullRefund = totalRefunded >= localCharge.amountCents;
  await prisma.registration.update({
    where: { id: localCharge.registrationId },
    data: {
      refundedCents: totalRefunded,
      ...(isFullRefund ? { status: RegistrationStatus.REFUNDED } : {}),
    },
  });
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
