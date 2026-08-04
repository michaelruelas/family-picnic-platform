import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());
const mockRefundsCreate = vi.hoisted(() => vi.fn());
const mockWebhooksConstruct = vi.hoisted(() => vi.fn());
const mockWebhooksGenerateHeader = vi.hoisted(() => vi.fn());

function makeMockClient() {
  return {
    paymentIntents: { create: mockCreate },
    refunds: { create: mockRefundsCreate },
    webhooks: {
      constructEventAsync: mockWebhooksConstruct,
      generateTestHeaderString: mockWebhooksGenerateHeader,
    },
  };
}

const StripeMock = vi.hoisted(() => {
  function StripeMockImpl(this: unknown) {
    return makeMockClient();
  }
  return StripeMockImpl as unknown as ReturnType<typeof vi.fn> & (new () => unknown);
});

vi.mock('stripe', () => ({
  default: StripeMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockCreate.mockReset();
  mockRefundsCreate.mockReset();
  mockWebhooksConstruct.mockReset();
  mockWebhooksGenerateHeader.mockReset();
});

describe('isConfigured', () => {
  it('returns false when STRIPE_SECRET_KEY is missing', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    const { isConfigured } = await import('../stripe');
    expect(isConfigured()).toBe(false);
  });

  it('returns false when STRIPE_PUBLISHABLE_KEY is missing', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', '');
    const { isConfigured } = await import('../stripe');
    expect(isConfigured()).toBe(false);
  });

  it('returns true when both keys are set', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    const { isConfigured } = await import('../stripe');
    expect(isConfigured()).toBe(true);
  });
});

describe('isWebhookConfigured', () => {
  it('returns true when STRIPE_WEBHOOK_SECRET is set', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_abc');
    const { isWebhookConfigured } = await import('../stripe');
    expect(isWebhookConfigured()).toBe(true);
  });

  it('returns false when STRIPE_WEBHOOK_SECRET is missing', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const { isWebhookConfigured } = await import('../stripe');
    expect(isWebhookConfigured()).toBe(false);
  });
});

describe('getPublishableKey / getWebhookSecret', () => {
  it('returns empty string when env is missing', async () => {
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', '');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const { getPublishableKey, getWebhookSecret } = await import('../stripe');
    expect(getPublishableKey()).toBe('');
    expect(getWebhookSecret()).toBe('');
  });

  it('returns env value when set', async () => {
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_publishable');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_secret');
    const { getPublishableKey, getWebhookSecret } = await import('../stripe');
    expect(getPublishableKey()).toBe('pk_test_publishable');
    expect(getWebhookSecret()).toBe('whsec_secret');
  });
});

describe('getStripeClient', () => {
  it('throws when STRIPE_SECRET_KEY is missing', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    const { getStripeClient } = await import('../stripe');
    expect(() => getStripeClient()).toThrow(/not configured/);
  });

  it('returns a Stripe client when configured', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    const { getStripeClient } = await import('../stripe');
    const client = getStripeClient();
    expect(client).toBeDefined();
    expect(client.paymentIntents).toBeDefined();
  });
});

describe('createPaymentIntent', () => {
  it('calls paymentIntents.create with idempotency key and metadata', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret_abc',
      status: 'requires_payment_method',
      amount: 2500,
      currency: 'usd',
    });
    const { createPaymentIntent } = await import('../stripe');
    const result = await createPaymentIntent({
      amountCents: 2500,
      currency: 'usd',
      idempotencyKey: 'charge-1',
      metadata: { eventId: 'evt_1', userId: 'usr_1' },
      receiptEmail: 'user@example.com',
      description: 'Test event',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: 'usd',
        metadata: { eventId: 'evt_1', userId: 'usr_1' },
        receipt_email: 'user@example.com',
        description: 'Test event',
        automatic_payment_methods: { enabled: true },
      }),
      { idempotencyKey: 'charge-1' },
    );
    expect(result).toEqual({
      paymentIntentId: 'pi_123',
      clientSecret: 'pi_123_secret_abc',
      status: 'requires_payment_method',
      amountCents: 2500,
      currency: 'usd',
    });
  });

  it('throws when Stripe returns no client_secret', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: null,
      status: 'requires_payment_method',
      amount: 2500,
      currency: 'usd',
    });
    const { createPaymentIntent } = await import('../stripe');
    await expect(
      createPaymentIntent({
        amountCents: 2500,
        currency: 'usd',
        idempotencyKey: 'charge-2',
        metadata: {},
      }),
    ).rejects.toThrow(/client_secret/);
  });
});

describe('createRefund', () => {
  it('calls refunds.create with the payment_intent and amount', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockRefundsCreate.mockResolvedValue({
      id: 're_123',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
    });
    const { createRefund } = await import('../stripe');
    const result = await createRefund({
      paymentIntentId: 'pi_abc',
      amountCents: 1000,
      reason: 'requested_by_customer',
      idempotencyKey: 'refund-1',
    });
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      {
        payment_intent: 'pi_abc',
        amount: 1000,
        reason: 'requested_by_customer',
      },
      { idempotencyKey: 'refund-1' },
    );
    expect(result).toEqual({
      refundId: 're_123',
      amountCents: 1000,
      currency: 'usd',
      status: 'succeeded',
    });
  });

  it('omits reason and amount when not provided', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockRefundsCreate.mockResolvedValue({
      id: 're_124',
      amount: 2500,
      currency: 'usd',
      status: 'succeeded',
    });
    const { createRefund } = await import('../stripe');
    await createRefund({
      paymentIntentId: 'pi_xyz',
      idempotencyKey: 'refund-2',
    });
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_xyz' },
      { idempotencyKey: 'refund-2' },
    );
  });
});

describe('verifyWebhookSignature', () => {
  it('throws when secret is not configured', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    const { verifyWebhookSignature } = await import('../stripe');
    await expect(
      verifyWebhookSignature({ payload: '{}', signatureHeader: 't=1,v1=abc' }),
    ).rejects.toThrow(/not configured/);
  });

  it('throws when signature header is missing', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_abc');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    const { verifyWebhookSignature } = await import('../stripe');
    await expect(verifyWebhookSignature({ payload: '{}', signatureHeader: '' })).rejects.toThrow(
      /missing/,
    );
  });

  it('returns the parsed event when signature verifies', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_abc');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockWebhooksConstruct.mockResolvedValue({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1' } },
    });
    const { verifyWebhookSignature } = await import('../stripe');
    const result = await verifyWebhookSignature({
      payload: '{"id":"evt_1"}',
      signatureHeader: 't=1,v1=abc',
    });
    expect(result).toEqual({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1' } },
    });
    expect(mockWebhooksConstruct).toHaveBeenCalledWith('{"id":"evt_1"}', 't=1,v1=abc', 'whsec_abc');
  });

  it('accepts an explicit secret override', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_default');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockWebhooksConstruct.mockResolvedValue({
      id: 'evt_2',
      type: 'ping',
      data: { object: {} },
    });
    const { verifyWebhookSignature } = await import('../stripe');
    await verifyWebhookSignature({
      payload: '{}',
      signatureHeader: 't=1,v1=abc',
      secret: 'whsec_override',
    });
    expect(mockWebhooksConstruct).toHaveBeenCalledWith('{}', 't=1,v1=abc', 'whsec_override');
  });
});

describe('formatAmount', () => {
  it('formats USD amounts in en-US', async () => {
    const { formatAmount } = await import('../currency');
    expect(formatAmount(2500)).toBe('$25.00');
    expect(formatAmount(0)).toBe('$0.00');
    expect(formatAmount(1)).toBe('$0.01');
    expect(formatAmount(12345)).toBe('$123.45');
  });
});

describe('generateTestWebhookHeader', () => {
  it('delegates to Stripe SDK with the provided secret', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockWebhooksGenerateHeader.mockReturnValue('t=1234,v1=deadbeef');
    const { generateTestWebhookHeader } = await import('../stripe');
    const header = generateTestWebhookHeader({
      payload: '{"id":"evt_test"}',
      secret: 'whsec_test',
    });
    expect(mockWebhooksGenerateHeader).toHaveBeenCalledWith({
      payload: '{"id":"evt_test"}',
      secret: 'whsec_test',
    });
    expect(header).toBe('t=1234,v1=deadbeef');
  });
});
