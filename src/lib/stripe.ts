import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Pin the API version. Stripe updates its API surface frequently; pinning
// protects us from silent behavior changes between SDK and server. Bump
// deliberately when the team is ready to migrate.
export const STRIPE_API_VERSION = '2025-08-27.basil' as const;

export function isConfigured(): boolean {
  return Boolean(secretKey && publishableKey);
}

export function isWebhookConfigured(): boolean {
  return Boolean(webhookSecret);
}

export function getPublishableKey(): string {
  return publishableKey ?? '';
}

export function getWebhookSecret(): string {
  return webhookSecret ?? '';
}

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!secretKey) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  }
  if (!cachedClient) {
    cachedClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      typescript: true,
      appInfo: {
        name: 'family-picnic-platform',
        version: '0.1.0',
      },
    });
  }
  return cachedClient;
}

export type CreatePaymentIntentInput = {
  amountCents: number;
  currency: string;
  // Idempotency key is required. Re-submitting the same call with the same
  // key returns the same PaymentIntent, which makes button-mash and
  // page-refresh retries safe.
  idempotencyKey: string;
  metadata: Record<string, string>;
  // Pre-fill customer email when known. Stripe emails the receipt directly
  // too, but we also send our own branded receipt.
  receiptEmail?: string;
  description?: string;
};

export type CreatePaymentIntentResult = {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
  amountCents: number;
  currency: string;
};

export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<CreatePaymentIntentResult> {
  const stripe = getStripeClient();
  const params: Stripe.PaymentIntentCreateParams = {
    amount: input.amountCents,
    currency: input.currency,
    metadata: input.metadata,
    automatic_payment_methods: { enabled: true },
    description: input.description,
  };
  if (input.receiptEmail) params.receipt_email = input.receiptEmail;

  const intent = await stripe.paymentIntents.create(params, {
    idempotencyKey: input.idempotencyKey,
  });

  if (!intent.client_secret) {
    throw new Error('Stripe did not return a client_secret for the new PaymentIntent');
  }

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
    amountCents: intent.amount,
    currency: intent.currency,
  };
}

export type CreateRefundInput = {
  paymentIntentId: string;
  // null amount means "refund the unrefunded balance". The caller is
  // responsible for choosing full vs partial.
  amountCents?: number;
  reason?: string;
  // The Refund row's id, used as the Stripe idempotency key so a retry of
  // the same refund request does not create a duplicate Stripe object.
  idempotencyKey: string;
};

export type CreateRefundResult = {
  refundId: string;
  amountCents: number;
  currency: string;
  status: string;
};

export async function createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
  const stripe = getStripeClient();
  const params: Stripe.RefundCreateParams = {
    payment_intent: input.paymentIntentId,
    ...(input.amountCents !== undefined ? { amount: input.amountCents } : {}),
    ...(input.reason ? { reason: input.reason as Stripe.RefundCreateParams.Reason } : {}),
  };
  const refund = await stripe.refunds.create(params, {
    idempotencyKey: input.idempotencyKey,
  });
  return {
    refundId: refund.id,
    amountCents: refund.amount,
    currency: refund.currency,
    status: refund.status ?? 'unknown',
  };
}

export type VerifiedWebhookEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 * Throws if the signature is invalid or the secret is not configured.
 *
 * Caller MUST pass the raw request body, not a parsed JSON object. The
 * signature is computed over the byte-precise payload Stripe sent.
 */
export async function verifyWebhookSignature(args: {
  payload: string | Buffer;
  signatureHeader: string;
  secret?: string;
}): Promise<VerifiedWebhookEvent> {
  const secret = args.secret ?? webhookSecret;
  if (!secret) {
    throw new Error('Stripe webhook secret is not configured');
  }
  if (!args.signatureHeader) {
    throw new Error('Stripe-Signature header is missing');
  }
  const stripe = getStripeClient();
  const event = await stripe.webhooks.constructEventAsync(
    args.payload,
    args.signatureHeader,
    secret,
  );
  return { id: event.id, type: event.type, data: { object: event.data.object } };
}

export function generateTestWebhookHeader(args: { payload: string; secret: string }): string {
  const stripe = getStripeClient();
  return stripe.webhooks.generateTestHeaderString({
    payload: args.payload,
    secret: args.secret,
  });
}
