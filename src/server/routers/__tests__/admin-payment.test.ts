import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Role } from '~/lib/generated/enums';

const mockPrisma = {
  charge: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  refund: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  registration: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('~/lib/prisma', () => ({ prisma: mockPrisma }));

const mockWriteAuditLog = vi.fn();
const mockDiff = vi.fn();
vi.mock('~/lib/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
  diff: (...args: unknown[]) => mockDiff(...args),
}));

const mockCreateRefund = vi.fn();
const mockFormatAmount = vi.fn((cents: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    cents / 100,
  ),
);
const mockIsStripeConfigured = vi.fn();

vi.mock('~/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/stripe')>();
  return {
    ...actual,
    createRefund: (...args: unknown[]) => mockCreateRefund(...args),
    formatAmount: mockFormatAmount,
    isConfigured: () => mockIsStripeConfigured(),
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
  EventStatus: { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED' },
  RSVPStatus: { CONFIRMED: 'CONFIRMED', DECLINED: 'DECLINED' },
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

const userSession = {
  user: {
    id: 'user-1',
    name: 'User',
    email: 'user@x.com',
    role: 'ADMIN_ADULT' as Role,
    householdId: 'h-1',
  },
  expires: 'x',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((ops: unknown) => {
    if (typeof ops === 'function') return (ops as (tx: typeof mockPrisma) => unknown)(mockPrisma);
    return Promise.all(ops as Promise<unknown>[]);
  });
  vi.unstubAllEnvs();
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  mockIsStripeConfigured.mockReturnValue(true);
  mockCreateRefund.mockResolvedValue({
    refundId: 're_1',
    amountCents: 1000,
    currency: 'usd',
    status: 'succeeded',
  });
});

describe('admin.listCharges', () => {
  it('returns up to 200 charges with relations', async () => {
    mockPrisma.charge.findMany.mockResolvedValue([]);
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.listCharges();
    expect(mockPrisma.charge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('filters by eventId and status when provided', async () => {
    mockPrisma.charge.findMany.mockResolvedValue([]);
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.listCharges({ eventId: 'evt-1', status: 'SUCCEEDED' });
    expect(mockPrisma.charge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { registration: { eventId: 'evt-1' }, status: 'SUCCEEDED' },
      }),
    );
  });
});

describe('admin.refund', () => {
  it('rejects when Stripe is not configured', async () => {
    mockIsStripeConfigured.mockReturnValue(false);
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.refund({ chargeId: 'ch-1' })).rejects.toThrow(/not configured/i);
  });

  it('rejects when charge is missing', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue(null);
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.refund({ chargeId: 'missing' })).rejects.toThrow(/not found/i);
  });

  it('rejects when charge is not SUCCEEDED', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'FAILED',
      amountCents: 2500,
      currency: 'usd',
      stripePaymentIntentId: 'pi_1',
      registrationId: 'reg-1',
      registration: { refunds: [] },
    });
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.refund({ chargeId: 'ch-1' })).rejects.toThrow(/succeeded/i);
  });

  it('issues a partial refund and keeps registration PAID', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      stripePaymentIntentId: 'pi_1',
      registrationId: 'reg-1',
      registration: { id: 'reg-1', eventId: 'evt-1', status: 'PAID', refunds: [] },
    });
    mockPrisma.refund.create.mockResolvedValue({ id: 'r-1' });
    mockPrisma.refund.update.mockResolvedValue({ id: 'r-1', status: 'SUCCEEDED' });
    mockPrisma.registration.update.mockResolvedValue({ id: 'reg-1', status: 'PAID' });
    mockCreateRefund.mockResolvedValue({
      refundId: 're_1',
      amountCents: 1000,
      currency: 'usd',
      status: 'succeeded',
    });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.refund({ chargeId: 'ch-1', amountCents: 1000, reason: 'oops' });

    expect(mockCreateRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: 'pi_1',
        amountCents: 1000,
        reason: 'oops',
        idempotencyKey: 'r-1',
      }),
    );
    expect(result.registration.status).toBe('PAID');
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.refunded' }),
    );
  });

  it('marks registration REFUNDED when amount equals full remaining balance', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      stripePaymentIntentId: 'pi_1',
      registrationId: 'reg-1',
      registration: { id: 'reg-1', eventId: 'evt-1', status: 'PAID', refunds: [] },
    });
    mockPrisma.refund.create.mockResolvedValue({ id: 'r-1' });
    mockPrisma.refund.update.mockResolvedValue({ id: 'r-1', status: 'SUCCEEDED' });
    mockPrisma.registration.update.mockResolvedValue({ id: 'reg-1', status: 'REFUNDED' });
    mockCreateRefund.mockResolvedValue({
      refundId: 're_1',
      amountCents: 2500,
      currency: 'usd',
      status: 'succeeded',
    });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.refund({ chargeId: 'ch-1' });

    expect(mockCreateRefund).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 2500 }));
    expect(result.registration.status).toBe('REFUNDED');
  });

  it('rejects when refund amount exceeds remaining balance', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      stripePaymentIntentId: 'pi_1',
      registrationId: 'reg-1',
      registration: { id: 'reg-1', eventId: 'evt-1', status: 'PAID', refunds: [] },
    });
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.refund({ chargeId: 'ch-1', amountCents: 9999 })).rejects.toThrow(
      /exceeds remaining/i,
    );
  });

  it('rejects non-admin callers', async () => {
    const nonAdminSession = {
      user: {
        id: 'user-2',
        name: 'Guest',
        email: 'guest@x.com',
        role: 'GUEST' as unknown as Role,
        householdId: null,
      },
      expires: 'x',
    };
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: nonAdminSession });
    await expect(caller.refund({ chargeId: 'ch-1' })).rejects.toThrow();
  });

  it('uses an atomic increment for refundedCents and Serializable isolation', async () => {
    // Two concurrent admins must not race the read-modify-write of
    // refundedCents; the fix is to bump with `increment` inside a
    // Serializable transaction. After the increment, the post-read
    // value decides the full-refund status flip.
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      stripePaymentIntentId: 'pi_1',
      registrationId: 'reg-1',
      registration: { id: 'reg-1', eventId: 'evt-1', status: 'PAID', refunds: [] },
    });
    mockPrisma.refund.create.mockResolvedValue({ id: 'r-iso' });
    mockPrisma.refund.update.mockResolvedValue({ id: 'r-iso', status: 'SUCCEEDED' });
    // Post-increment read returns the new running total, which here
    // exactly equals the charge amount — so the status update fires.
    mockPrisma.registration.update.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
      refundedCents: 2500,
    });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.refund({ chargeId: 'ch-1', amountCents: 2500 });

    // The increment runs inside a Serializable transaction so concurrent
    // admins serialize cleanly.
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(mockPrisma.registration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundedCents: { increment: 2500 } }),
      }),
    );
    // The post-increment read says refundedCents == 2500, so the
    // status flip runs as a separate update.
    expect(mockPrisma.registration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reg-1' },
        data: { status: 'REFUNDED' },
      }),
    );
  });

  it('skips the status flip when refundedCents is still below the charge amount', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      stripePaymentIntentId: 'pi_1',
      registrationId: 'reg-1',
      registration: { id: 'reg-1', eventId: 'evt-1', status: 'PAID', refunds: [] },
    });
    mockPrisma.refund.create.mockResolvedValue({ id: 'r-partial' });
    mockPrisma.refund.update.mockResolvedValue({ id: 'r-partial', status: 'SUCCEEDED' });
    mockPrisma.registration.update.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
      refundedCents: 500, // post-increment read; partial refund, not full
    });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.refund({ chargeId: 'ch-1', amountCents: 500 });

    // Only the increment; no follow-up status update.
    expect(mockPrisma.registration.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.registration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundedCents: { increment: 500 } }),
      }),
    );
  });
});

describe('admin.forfeit', () => {
  it('rejects when registration is missing', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(null);
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.forfeit({ registrationId: 'reg-1' })).rejects.toThrow(/not found/i);
  });

  it('rejects when already forfeited', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'FORFEITED',
      eventId: 'evt-1',
      refundedCents: 0,
    });
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.forfeit({ registrationId: 'reg-1' })).rejects.toThrow(/already forfeited/i);
  });

  it('rejects when already refunded', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'REFUNDED',
      eventId: 'evt-1',
      refundedCents: 2500,
    });
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.forfeit({ registrationId: 'reg-1' })).rejects.toThrow(/refunded/i);
  });

  it('forfeits a paid registration and writes audit', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
      eventId: 'evt-1',
      refundedCents: 0,
    });
    mockPrisma.registration.update.mockResolvedValue({
      id: 'reg-1',
      status: 'FORFEITED',
      eventId: 'evt-1',
      refundedCents: 0,
    });
    mockDiff.mockReturnValue({ status: { old: 'PAID', new: 'FORFEITED' } });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.forfeit({ registrationId: 'reg-1', reason: 'no-show' });
    expect(mockPrisma.registration.update).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: { status: 'FORFEITED' },
    });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.forfeited' }),
    );
  });
});

describe('admin.resendReceipt', () => {
  it('rejects when charge is missing', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue(null);
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.resendReceipt({ chargeId: 'missing' })).rejects.toThrow(/not found/i);
  });

  it('rejects when charge is not succeeded', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'FAILED',
      amountCents: 2500,
      currency: 'usd',
      registration: {
        user: { id: 'u-1', name: 'A', email: 'a@x.com' },
        event: { id: 'e-1', name: 'E', date: new Date('2026-08-15T11:00:00Z') },
      },
    });
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.resendReceipt({ chargeId: 'ch-1' })).rejects.toThrow(/succeeded/i);
  });

  it('sends receipt and updates receiptSentAt on success', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      receiptUrl: 'https://stripe.com/r/1',
      registrationId: 'reg-1',
      registration: {
        id: 'reg-1',
        eventId: 'evt-1',
        user: { id: 'u-1', name: 'A', email: 'a@x.com' },
        event: { id: 'evt-1', name: 'E', date: new Date('2026-08-15T11:00:00Z') },
      },
    });
    mockSendRegistrationReceipt.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockPrisma.charge.update.mockResolvedValue({});

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.resendReceipt({ chargeId: 'ch-1' });
    expect(result).toEqual({ success: true, messageId: 'msg-1' });
    expect(mockPrisma.charge.update).toHaveBeenCalledWith({
      where: { id: 'ch-1' },
      data: { receiptSentAt: expect.any(Date) },
    });
  });

  it('does not mark receiptSentAt when the email fails', async () => {
    mockPrisma.charge.findUnique.mockResolvedValue({
      id: 'ch-1',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      receiptUrl: null,
      registrationId: 'reg-1',
      registration: {
        id: 'reg-1',
        eventId: 'evt-1',
        user: { id: 'u-1', name: 'A', email: 'a@x.com' },
        event: { id: 'evt-1', name: 'E', date: new Date('2026-08-15T11:00:00Z') },
      },
    });
    mockSendRegistrationReceipt.mockResolvedValue({ success: false, error: 'sendgrid down' });
    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.resendReceipt({ chargeId: 'ch-1' });
    expect(result).toEqual({ success: false, error: 'sendgrid down' });
    expect(mockPrisma.charge.update).not.toHaveBeenCalled();
  });
});
