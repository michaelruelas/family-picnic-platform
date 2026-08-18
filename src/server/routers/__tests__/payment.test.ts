import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Role } from '~/lib/generated/enums';

const NON_ADMIN_ROLE = 'GUEST' as unknown as Role;

const mockPrisma = {
  event: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  rSVP: { findUnique: vi.fn() },
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
    updateMany: vi.fn(),
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
const mockRetrievePaymentIntent = vi.fn();

vi.mock('~/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/stripe')>();
  return {
    ...actual,
    createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
    createRefund: (...args: unknown[]) => mockCreateRefund(...args),
    getPublishableKey: () => mockGetPublishableKey(),
    isConfigured: () => mockIsStripeConfigured(),
    getStripeClient: () => ({
      paymentIntents: { retrieve: (...args: unknown[]) => mockRetrievePaymentIntent(...args) },
    }),
  };
});

vi.mock('~/lib/currency', () => ({
  formatAmount: (cents: number, currency = 'usd') =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100),
}));

const mockSendRegistrationReceipt = vi.fn();
vi.mock('~/lib/receipt', () => ({
  sendRegistrationReceipt: (...args: unknown[]) => mockSendRegistrationReceipt(...args),
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('~/lib/auth', () => ({
  authOptions: {},
  getServerSession: vi.fn(),
  isAdminRole: (role: unknown) => role === 'SUPER_ADMIN' || role === 'ADMIN',
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
  RsvpAttending: { YES: 'YES', NO: 'NO', MAYBE: 'MAYBE' },
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
    role: 'ADMIN' as Role,
    householdId: 'h-1',
  },
  expires: 'x',
};

const adminSession = {
  user: {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@x.com',
    role: 'SUPER_ADMIN' as Role,
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
  // Default: no terminal drift — the call site has to opt in by
  // overriding this with a `mockResolvedValueOnce` for the specific
  // intent it wants to fake.
  mockRetrievePaymentIntent.mockResolvedValue({
    id: 'pi_default',
    status: 'requires_payment_method',
  });
  mockCreatePaymentIntent.mockResolvedValue({
    paymentIntentId: 'pi_1',
    clientSecret: 'pi_1_secret_xyz',
    status: 'requires_payment_method',
    amountCents: 2500,
    currency: 'usd',
  });
});

// FPP-124: when the procedure calls Stripe for a top-up charge the
// intent amount comes from the call's `amountCents` argument, not
// a hard-coded stub. The default beforeEach mock echoes a flat
// 2500 cents which would mask assertions on the delta — tests that
// care about the charge amount opt in to this passthrough.
const echoAmountFromCall = () => {
  mockCreatePaymentIntent.mockImplementation(async (input: { amountCents: number }) => ({
    paymentIntentId: 'pi_1',
    clientSecret: 'pi_1_secret_xyz',
    status: 'requires_payment_method',
    amountCents: input.amountCents,
    currency: 'usd',
  }));
};

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

  it('rejects when the user is already PAID and has nothing left to pay', async () => {
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
    // FPP-124: the PAID branch now compares against net paid, so the
    // mock must reflect a successful charge for the full fee. Without
    // it the procedure would treat the user as owing the full amount
    // and create a top-up charge — covered by the dedicated test
    // below.
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
      charges: [{ id: 'ch-1', amountCents: 2500, currency: 'usd', status: 'SUCCEEDED' }],
      refunds: [],
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

  it('syncs an active charge whose Stripe intent has moved to SUCCEEDED before reusing it', async () => {
    // Repro of the production bug: the user paid via the Stripe
    // dashboard (out of band) so the intent is SUCCEEDED but our local
    // charge is still REQUIRES_PAYMENT_METHOD. Without the pre-flight
    // sync we'd hand `<Elements>` a terminal-state client_secret and
    // Stripe.js would throw "This PaymentIntent is in a terminal
    // state and cannot be used to initialize Elements".
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
    // First read (pre-flight) sees the stale active charge.
    mockPrisma.registration.findUnique.mockResolvedValueOnce({
      id: 'reg-stale',
      status: 'PENDING',
      charges: [
        {
          id: 'ch-stale',
          stripePaymentIntentId: 'pi_already_paid',
          amountCents: 2500,
          currency: 'usd',
          status: 'REQUIRES_PAYMENT_METHOD',
        },
      ],
    });
    mockRetrievePaymentIntent.mockResolvedValueOnce({
      id: 'pi_already_paid',
      status: 'succeeded',
    });
    // Second read (inside the transaction) reflects the sync: the
    // stale charge has been flipped to SUCCEEDED, so the create-new
    // branch fires instead.
    mockPrisma.registration.findUnique.mockResolvedValueOnce({
      id: 'reg-stale',
      status: 'PENDING',
      charges: [
        {
          id: 'ch-stale',
          stripePaymentIntentId: 'pi_already_paid',
          amountCents: 2500,
          currency: 'usd',
          status: 'SUCCEEDED',
        },
      ],
    });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-fresh',
      amountCents: 2500,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-fresh',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await caller.createPaymentIntent({ eventId: 'evt-1' });

    // Stale charge was flipped to SUCCEEDED locally so the next caller
    // can't reuse it.
    expect(mockPrisma.charge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ch-stale' },
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    );
    // ...and the caller gets a fresh charge/intent pair, not the
    // cached terminal-state client_secret.
    expect(mockPrisma.charge.create).toHaveBeenCalledTimes(1);
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'ch-fresh' }),
    );
    expect(mockRetrievePaymentIntent).toHaveBeenCalledWith('pi_already_paid');
  });

  it('skips the sync when the active intent is non-terminal', async () => {
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
      id: 'reg-2',
      status: 'PENDING',
      charges: [
        {
          id: 'ch-active',
          stripePaymentIntentId: 'pi_still_waiting',
          amountCents: 2500,
          currency: 'usd',
          status: 'REQUIRES_PAYMENT_METHOD',
        },
      ],
    });
    mockRetrievePaymentIntent.mockResolvedValueOnce({
      id: 'pi_still_waiting',
      status: 'requires_payment_method',
    });
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-active',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await caller.createPaymentIntent({ eventId: 'evt-1' });

    // We re-touched Stripe to ask, but the local row is unchanged and
    // the existing charge is reused — no fresh Stripe intent created.
    expect(mockRetrievePaymentIntent).toHaveBeenCalledWith('pi_still_waiting');
    expect(mockPrisma.charge.create).not.toHaveBeenCalled();
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'ch-active' }),
    );
  });

  it('swallows Stripe retrieve failures so a Stripe outage cannot block checkout', async () => {
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
      id: 'reg-outage',
      status: 'PENDING',
      charges: [
        {
          id: 'ch-outage',
          stripePaymentIntentId: 'pi_unknown',
          amountCents: 2500,
          currency: 'usd',
          status: 'REQUIRES_PAYMENT_METHOD',
        },
      ],
    });
    mockRetrievePaymentIntent.mockRejectedValueOnce(new Error('stripe api is down'));
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-outage',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });

    // The procedure still completes — falling back to the local
    // optimistic view keeps the user unblocked during a Stripe outage.
    // The audit log gets a `payment.intentReconcileFailed` row so the
    // ops team can spot the drift on the next deploy.
    const { writeAuditLog } = await import('~/lib/audit');
    await caller.createPaymentIntent({ eventId: 'evt-1' });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.intentReconcileFailed' }),
    );
    expect(mockPrisma.charge.create).not.toHaveBeenCalled();
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'ch-outage' }),
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

  it('retries the whole procedure when the transaction raises P2034', async () => {
    // First call to $transaction throws Postgres serialization failure,
    // second call succeeds. The outer wrapper retries the body; Stripe's
    // idempotencyKey on the PaymentIntent call is still charge.id and
    // would de-dupe any Stripe-side duplicate even if it ran twice.
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
    mockPrisma.registration.create.mockResolvedValue({ id: 'reg-retry', status: 'PENDING' });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-retry',
      amountCents: 2500,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-retry',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    mockPrisma.$transaction.mockImplementationOnce(() => {
      throw { code: 'P2034', message: 'lost the race' };
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.createPaymentIntent({ eventId: 'evt-1' });

    expect(result.chargeId).toBe('ch-retry');
    // One call rolled back, one call succeeded.
    expect(mockPrisma.$transaction.mock.calls.length).toBe(2);
    // Stripe got exactly one createPaymentIntent call (the second attempt).
    expect(mockCreatePaymentIntent).toHaveBeenCalledTimes(1);
  });

  // FPP-124: when the user already paid for 1 attendee ($5) and then
  // added a 2nd attendee (now $10 expected), the procedure must allow
  // a top-up charge for the $5 delta instead of throwing
  // "already registered".
  it('creates a top-up charge for the outstanding delta when PAID with remaining balance', async () => {
    echoAmountFromCall();
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'Picnic',
      status: 'PUBLISHED',
      registrationFeeCents: 500,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    // 2 attendees × $5 = $10 expected; user has paid $5 for 1 attendee
    // so far and is now settling up for the 2nd.
    mockPrisma.rSVP.findUnique.mockResolvedValue({
      memberAttendances: [
        { attending: 'YES', memberAgeSnapshot: 35 },
        { attending: 'YES', memberAgeSnapshot: 8 },
      ],
    });
    // Both the pre-flight read and the in-transaction read return the
    // same PAID registration with one SUCCEEDED $5 charge. The active-
    // charge filter in the pre-flight select would normally hide it,
    // but the mock returns the full record for both reads so the PAID
    // branch fires.
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-paid',
      status: 'PAID',
      charges: [{ id: 'ch-old', amountCents: 500, currency: 'usd', status: 'SUCCEEDED' }],
      refunds: [],
    });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-topup',
      amountCents: 500,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-topup',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.createPaymentIntent({ eventId: 'evt-1' });

    // The new charge is for the $5 delta, not the full $10 — so the
    // top-up cannot over-collect.
    expect(mockPrisma.charge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationId: 'reg-paid',
          amountCents: 500,
        }),
      }),
    );
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 500,
        idempotencyKey: 'ch-topup',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        registrationId: 'reg-paid',
        chargeId: 'ch-topup',
        amountCents: 500,
      }),
    );
  });

  it('nets SUCCEEDED refunds when computing the top-up delta', async () => {
    // User paid $25, was refunded $10 (net $15). After adding another
    // attendee the expected fee becomes $30, so the top-up charges $15.
    echoAmountFromCall();
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'Picnic',
      status: 'PUBLISHED',
      registrationFeeCents: 1000,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue({
      memberAttendances: [
        { attending: 'YES', memberAgeSnapshot: 35 },
        { attending: 'YES', memberAgeSnapshot: 40 },
        { attending: 'YES', memberAgeSnapshot: 10 },
      ],
    });
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-paid',
      status: 'PAID',
      charges: [{ id: 'ch-old', amountCents: 2500, currency: 'usd', status: 'SUCCEEDED' }],
      refunds: [
        { amountCents: 1000, status: 'SUCCEEDED' },
        { amountCents: 500, status: 'PENDING' }, // ignored — only SUCCEEDED counts
      ],
    });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-topup',
      amountCents: 1500,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-topup',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await caller.createPaymentIntent({ eventId: 'evt-1' });

    // $30 expected ($10 × 3 attendees) − ($25 paid − $10 refunded) = $15.
    expect(mockPrisma.charge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 1500 }),
      }),
    );
  });

  it('falls back to the per-attendee fee when the user has no RSVP yet (checkout page)', async () => {
    echoAmountFromCall();
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
    mockPrisma.rSVP.findUnique.mockResolvedValue(null);
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'reg-checkout', status: 'PENDING' });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-checkout',
      amountCents: 2500,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-checkout',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await caller.createPaymentIntent({ eventId: 'evt-1' });

    expect(mockPrisma.charge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 2500 }),
      }),
    );
  });

  it('uses the roster fee (not the per-attendee fee) when an RSVP exists', async () => {
    // 2 qualifying attendees × $5 = $10 (not the per-attendee $5).
    echoAmountFromCall();
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      name: 'Picnic',
      status: 'PUBLISHED',
      registrationFeeCents: 500,
      currency: 'usd',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@example.com',
      name: 'Maria',
      householdId: 'h-1',
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue({
      memberAttendances: [
        { attending: 'YES', memberAgeSnapshot: 35 },
        { attending: 'YES', memberAgeSnapshot: 40 },
      ],
    });
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'reg-roster', status: 'PENDING' });
    mockPrisma.charge.create.mockResolvedValue({
      id: 'ch-roster',
      amountCents: 1000,
      currency: 'usd',
    });
    mockPrisma.charge.update.mockResolvedValue({
      id: 'ch-roster',
      status: 'REQUIRES_PAYMENT_METHOD',
    });

    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    await caller.createPaymentIntent({ eventId: 'evt-1' });

    expect(mockPrisma.charge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 1000 }),
      }),
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

  // FPP-124: the bottom sheet derives the remaining balance from
  // these sums. Only SUCCEEDED charges and SUCCEEDED refunds count;
  // pending / failed / canceled rows are excluded so the UI does not
  // show "Amount due: $0" when a charge is still in flight.
  it('sums SUCCEEDED charges minus SUCCEEDED refunds into amountPaidCents / netPaidCents', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-mixed',
      status: 'PENDING',
      amountCents: 2500,
      refundedCents: 500,
      currency: 'usd',
      receiptSentAt: null,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
      charges: [
        {
          id: 'ch-good',
          status: 'SUCCEEDED',
          amountCents: 2000,
          receiptUrl: null,
          createdAt: new Date(),
        },
        {
          id: 'ch-failed',
          status: 'FAILED',
          amountCents: 2500,
          receiptUrl: null,
          createdAt: new Date(),
        },
        {
          id: 'ch-pending',
          status: 'REQUIRES_PAYMENT_METHOD',
          amountCents: 2500,
          receiptUrl: null,
          createdAt: new Date(),
        },
      ],
      refunds: [
        {
          id: 'rf-good',
          amountCents: 500,
          status: 'SUCCEEDED',
          reason: null,
          createdAt: new Date(),
        },
        {
          id: 'rf-pending',
          amountCents: 200,
          status: 'PENDING',
          reason: null,
          createdAt: new Date(),
        },
      ],
    });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.getMyRegistration({ eventId: 'evt-1' });
    expect(result).toEqual(
      expect.objectContaining({
        amountPaidCents: 2000,
        amountRefundedCents: 500,
        netPaidCents: 1500,
      }),
    );
  });
});

describe('payment.payLater', () => {
  it('is a no-op when the user has no registration row', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.payLater({ eventId: 'evt-1' });
    expect(result).toEqual({ changed: false, status: 'PENDING' });
    expect(mockPrisma.charge.updateMany).not.toHaveBeenCalled();
  });

  it('is a no-op when the registration has no fee', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PENDING',
      amountCents: 0,
      currency: 'usd',
    });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.payLater({ eventId: 'evt-1' });
    expect(result.changed).toBe(false);
    expect(mockPrisma.charge.updateMany).not.toHaveBeenCalled();
  });

  it('leaves settled registrations alone', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
      amountCents: 2500,
      currency: 'usd',
    });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.payLater({ eventId: 'evt-1' });
    expect(result).toEqual({ changed: false, status: 'PAID' });
    expect(mockPrisma.charge.updateMany).not.toHaveBeenCalled();
  });

  it('cancels active charges and keeps the registration PENDING', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PENDING',
      amountCents: 2500,
      currency: 'usd',
    });
    mockPrisma.charge.updateMany.mockResolvedValue({ count: 1 });
    const { paymentRouter } = await import('~/server/routers/payment.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(paymentRouter)({ session: userSession });
    const result = await caller.payLater({ eventId: 'evt-1' });
    expect(result).toEqual({ changed: true, status: 'PENDING' });
    expect(mockPrisma.charge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registrationId: 'reg-1',
          status: { in: expect.any(Array) },
        }),
        data: { status: 'CANCELED' },
      }),
    );
  });
});
