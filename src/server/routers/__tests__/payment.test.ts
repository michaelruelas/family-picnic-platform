import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Role } from '~/lib/generated/enums';

const NON_ADMIN_ROLE = 'GUEST' as unknown as Role;

const mockPrisma = {
  event: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  registration: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  charge: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  refund: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('~/lib/prisma', () => ({ prisma: mockPrisma }));

vi.mock('~/lib/audit', () => ({
  writeAuditLog: vi.fn(),
  diff: vi.fn(),
}));

const mockCreatePaymentIntent = vi.fn();
const mockCreateRefund = vi.fn();
const mockGetPublishableKey = vi.fn();
const mockIsStripeConfigured = vi.fn();

vi.mock('~/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/stripe')>();
  return {
    ...actual,
    createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
    createRefund: (...args: unknown[]) => mockCreateRefund(...args),
    getPublishableKey: () => mockGetPublishableKey(),
    isConfigured: () => mockIsStripeConfigured(),
    formatAmount: (cents: number, currency = 'usd') =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(cents / 100),
  };
});

const mockSendRegistrationReceipt = vi.fn();
vi.mock('~/lib/receipt', () => ({
  sendRegistrationReceipt: (...args: unknown[]) => mockSendRegistrationReceipt(...args),
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('~/lib/auth', () => ({
  authOptions: {},
  getServerSession: vi.fn(),
  isAdminRole: (role: unknown) => role === 'ADMIN' || role === 'ADMIN_ADULT',
}));

vi.mock('~/lib/generated/enums', () => ({
  EventStatus: { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', CLOSED: 'CLOSED', CANCELLED: 'CANCELLED' },
  RSVPStatus: { CONFIRMED: 'CONFIRMED', DECLINED: 'DECLINED', PENDING: 'PENDING' },
  InvitationStatus: { PENDING: 'PENDING', USED: 'USED' },
  RegistrationStatus: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    REFUNDED: 'REFUNDED',
    FORFEITED: 'FORFEITED',
    CANCELLED: 'CANCELLED',
  },
  ChargeStatus: {
    REQUIRES_PAYMENT_METHOD: 'REQUIRES_PAYMENT_METHOD',
    REQUIRES_CONFIRMATION: 'REQUIRES_CONFIRMATION',
    REQUIRES_ACTION: 'REQUIRES_ACTION',
    PROCESSING: 'PROCESSING',
    REQUIRES_CAPTURE: 'REQUIRES_CAPTURE',
    SUCCEEDED: 'SUCCEEDED',
    CANCELED: 'CANCELED',
    FAILED: 'FAILED',
  },
  RefundStatus: {
    PENDING: 'PENDING',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELED: 'CANCELED',
  },
  CommunicationChannel: { EMAIL: 'EMAIL', SMS: 'SMS' },
  CommunicationStatus: { SENT: 'SENT', FAILED: 'FAILED' },
  CommunicationPreference: { EMAIL: 'EMAIL' },
  AdminPermission: { OWNER: 'OWNER', COADMIN: 'COADMIN' },
  PotluckCategory: { MAIN: 'MAIN' },
  SlotType: { LIMITED: 'LIMITED', UNLIMITED: 'UNLIMITED' },
}));

const userSession = {
  user: {
    id: 'user-1',
    name: 'Maria',
    email: 'maria@example.com',
    role: 'ADMIN_ADULT' as Role,
    householdId: 'h-1',
  },
  expires: 'x',
};

const adminSession = {
  user: {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@x.com',
    role: 'ADMIN' as Role,
    householdId: null,
  },
  expires: 'x',
};
void NON_ADMIN_ROLE;
void adminSession;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma),
  );
  vi.unstubAllEnvs();
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  mockIsStripeConfigured.mockReturnValue(true);
  mockGetPublishableKey.mockReturnValue('pk_test_abc');
  mockCreatePaymentIntent.mockResolvedValue({
    paymentIntentId: 'pi_1',
    clientSecret: 'pi_1_secret_xyz',
    status: 'requires_payment_method',
    amountCents: 2500,
    currency: 'usd',
  });
});

describe('payment.getPublishableKey', () => {
  it('returns the publishable key when Stripe is configured', async () => {
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: null });
    const result = await caller.getPublishableKey();
    expect(result).toEqual({ publishableKey: 'pk_test_abc' });
  });

  it('returns null when Stripe is not configured', async () => {
    mockIsStripeConfigured.mockReturnValue(false);
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: null });
    const result = await caller.getPublishableKey();
    expect(result).toEqual({ publishableKey: null });
  });
});

describe('payment.createPaymentIntent', () => {
  it('rejects when Stripe is not configured', async () => {
    mockIsStripeConfigured.mockReturnValue(false);
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await expect(caller.createPaymentIntent({ eventId: 'evt-1' })).rejects.toThrow(
      /not configured/i,
    );
  });

  it('rejects when event does not exist', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await expect(caller.createPaymentIntent({ eventId: 'missing' })).rejects.toThrow(/not found/i);
  });

  it('rejects when event is not published', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'X',
      status: 'DRAFT',
      registrationFeeCents: 2500,
      currency: 'usd',
    });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await expect(caller.createPaymentIntent({ eventId: 'evt-1' })).rejects.toThrow(
      /not accepting/i,
    );
  });

  it('rejects when event has no fee', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'X',
      status: 'PUBLISHED',
      registrationFeeCents: 0,
      currency: 'usd',
    });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await expect(caller.createPaymentIntent({ eventId: 'evt-1' })).rejects.toThrow(
      /does not require payment/i,
    );
  });

  it('rejects when the user is already PAID', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'X',
      status: 'PUBLISHED',
      registrationFeeCents: 2500,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
      charges: [],
    });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await expect(caller.createPaymentIntent({ eventId: 'evt-1' })).rejects.toThrow(
      /already registered/i,
    );
  });

  it('creates a Registration, Charge, and PaymentIntent, returns clientSecret', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'Picnic',
      status: 'PUBLISHED',
      registrationFeeCents: 2500,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'reg-new', status: 'PENDING' });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-new',
      amountCents: 2500,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({ id: 'ch-new', status: 'REQUIRES_PAYMENT_METHOD' });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.createPaymentIntent({ eventId: 'evt-1' });

    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 2500,
        currency: 'usd',
        metadata: expect.objectContaining({ eventId: 'evt-1', userId: 'user-1' }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        registrationId: 'reg-new',
        chargeId: 'ch-new',
        paymentIntentId: 'pi_1',
        clientSecret: 'pi_1_secret_xyz',
        amountCents: 2500,
        currency: 'usd',
        publishableKey: 'pk_test_abc',
      }),
    );
  });

  it('reuses an existing PENDING Registration with an active charge', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'Picnic',
      status: 'PUBLISHED',
      registrationFeeCents: 2500,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PENDING',
      charges: [
        { id: 'ch-1', amountCents: 2500, currency: 'usd', status: 'REQUIRES_PAYMENT_METHOD' },
      ],
    });
    mockPrisma.charge.update.mockResolvedValue({ id: 'ch-1', status: 'REQUIRES_PAYMENT_METHOD' });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await caller.createPaymentIntent({ eventId: 'evt-1' });
    expect(mockPrisma.registration.create).not.toHaveBeenCalled();
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'ch-1' }),
    );
  });

  it('marks the charge FAILED and writes audit when Stripe throws', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'Picnic',
      status: 'PUBLISHED',
      registrationFeeCents: 2500,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'reg-2' });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-2',
      amountCents: 2500,
      currency: 'usd',
    });
    mockCreatePaymentIntent.mockRejectedValueOnce(new Error('stripe down'));
    mockPrisma.charge.update.mockResolvedValue({});

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await expect(caller.createPaymentIntent({ eventId: 'evt-1' })).rejects.toThrow(
      /Failed to create payment intent/i,
    );
    expect(mockPrisma.charge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          lastErrorCode: 'CREATE_INTENT_FAILED',
          lastErrorMessage: 'stripe down',
        }),
      }),
    );
  });

  it('wraps the find-or-create transaction in Serializable isolation', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'Picnic',
      status: 'PUBLISHED',
      registrationFeeCents: 2500,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'reg-iso', status: 'PENDING' });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-iso',
      amountCents: 2500,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({ id: 'ch-iso', status: 'REQUIRES_PAYMENT_METHOD' });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await caller.createPaymentIntent({ eventId: 'evt-1' });

    // The first arg is the transaction function, the second must be the
    // Serializable isolation option — guards against accidental
    // regression to default Read Committed, which would re-open the
    // double-charge race Boop flagged.
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });
});

describe('payment.getMyRegistration', () => {
  it('returns null when the user has no registration', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    expect(await caller.getMyRegistration({ eventId: 'evt-1' })).toBeNull();
  });

  it('returns the registration, charges, and refunds', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
      amountCents: 2500,
      refundedCents: 0,
      currency: 'usd',
      receiptSentAt: new Date('2026-07-01T00:00:00Z'),
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
      charges: [
        {
          id: 'ch-1',
          status: 'SUCCEEDED',
          amountCents: 2500,
          receiptUrl: 'https://stripe.com/r/1',
          createdAt: new Date('2026-07-01T00:00:00Z'),
        },
      ],
      refunds: [],
    });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.getMyRegistration({ eventId: 'evt-1' });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'reg-1',
        status: 'PAID',
        amountCents: 2500,
        charges: expect.arrayContaining([expect.objectContaining({ status: 'SUCCEEDED' })]),
      }),
    );
  });
});
