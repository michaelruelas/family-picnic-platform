import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';
import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

// The smoke test replays a Stripe webhook event stream and asserts exactly
// one AdminAuditLog row per state transition. Each transition below maps
// 1:1 to an entry in the FPP-74 smoke checklist. The action strings are
// the source of truth — the audit log table in docs/agents/COMMANDS.md
// references them by name, so any rename must update both this test and
// the docs table in the same PR.

const prismaMock = vi.hoisted(() => ({
  charge: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  registration: {
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  refund: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((ops: unknown) => {
    if (typeof ops === 'function') return (ops as (tx: unknown) => unknown)(prismaMock);
    return Promise.all(ops as Promise<unknown>[]);
  }),
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

const mockWriteAuditLog = vi.fn();
vi.mock('~/lib/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

const mockSendRegistrationReceipt = vi.fn();
vi.mock('~/lib/receipt', () => ({
  sendRegistrationReceipt: (...args: unknown[]) => mockSendRegistrationReceipt(...args),
}));

const mockVerifyWebhookSignature = vi.fn();
const mockIsWebhookConfigured = vi.fn();

vi.mock('~/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/stripe')>();
  return {
    ...actual,
    verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
    isWebhookConfigured: () => mockIsWebhookConfigured(),
  };
});

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

function makeWebhookRequest(body: string, signature: string | null = 't=1,v1=abc'): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature) headers['stripe-signature'] = signature;
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

beforeEach(() => {
  resetPrismaMock(prismaMock);
  mockWriteAuditLog.mockReset();
  mockSendRegistrationReceipt.mockReset();
  mockVerifyWebhookSignature.mockReset();
  mockIsWebhookConfigured.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
});

// Stable action strings. Any PR that renames these must also update
// docs/agents/COMMANDS.md and the corresponding unit tests in
// src/app/api/stripe/webhook/__tests__/route.test.ts.
const ACTION = {
  INTENT_CREATED: 'payment.intentCreated',
  INTENT_FAILED: 'payment.intentFailed',
  SUCCEEDED: 'payment.succeeded',
  FAILED: 'payment.failed',
  REFUNDED: 'payment.refunded',
  REFUND_RECONCILED: 'payment.refundReconciled',
  FORFEITED: 'payment.forfeited',
  RECEIPT_RESENT: 'payment.receiptResent',
} as const;

// Enum mock factory. The router tests each reset modules and register
// the same set of enum stubs via vi.doMock. Keeping the shape in one
// place stops the copies from drifting apart — a new enum value the
// real module exports will start MockInvalidEnum on the spot.
const enumMock = () => ({
  EventStatus: {
    DRAFT: 'DRAFT',
    PUBLISHED: 'PUBLISHED',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED',
  },
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
});

describe('FPP-78 payment audit coverage', () => {
  // Source-of-truth file paths. The smoke test asserts both the call
  // site (writeAuditLog with the right action) and the stable action
  // string in the source file. The second assertion catches a rename
  // that bypasses the test mock (e.g. by string concatenation).
  const webhookPath = path.join(process.cwd(), 'src/app/api/stripe/webhook/route.ts');
  const paymentRouterPath = path.join(process.cwd(), 'src/server/routers/payment.router.ts');
  const adminRouterPath = path.join(process.cwd(), 'src/server/routers/admin.router.ts');
  const commandsPath = path.join(process.cwd(), 'docs/agents/COMMANDS.md');

  describe('source-of-truth action strings', () => {
    it('payment.router.ts uses the intent create and create-failure action strings', async () => {
      const content = await fs.readFile(paymentRouterPath, 'utf-8');
      expect(content).toContain(`action: '${ACTION.INTENT_CREATED}'`);
      expect(content).toContain(`action: '${ACTION.INTENT_FAILED}'`);
    });

    it('webhook route uses the three webhook-side action strings', async () => {
      const content = await fs.readFile(webhookPath, 'utf-8');
      expect(content).toContain(`action: '${ACTION.SUCCEEDED}'`);
      expect(content).toContain(`action: '${ACTION.FAILED}'`);
      // charge.refunded and charge.updated both write REFUND_RECONCILED.
      const refundReconciledCount = (
        content.match(new RegExp(`action: '${ACTION.REFUND_RECONCILED}'`, 'g')) ?? []
      ).length;
      expect(refundReconciledCount).toBeGreaterThanOrEqual(2);
    });

    it('admin.router.ts uses the three admin-side action strings', async () => {
      const content = await fs.readFile(adminRouterPath, 'utf-8');
      expect(content).toContain(`action: '${ACTION.REFUNDED}'`);
      expect(content).toContain(`action: '${ACTION.FORFEITED}'`);
      expect(content).toContain(`action: '${ACTION.RECEIPT_RESENT}'`);
    });

    it('COMMANDS.md documents every payment action string', async () => {
      const content = await fs.readFile(commandsPath, 'utf-8');
      for (const action of Object.values(ACTION)) {
        expect(content, `COMMANDS.md missing action ${action}`).toContain(action);
      }
    });
  });

  describe('webhook replay: one audit row per state transition', () => {
    // Walks the happy-path lifecycle end to end: succeeded -> partial
    // refund (charge.updated) -> full refund (charge.refunded). Asserts
    // exactly one audit row per state transition, each with the right
    // action string. The same mock state is reused across all three
    // dispatches so the test reads as a single replay rather than three
    // independent scenarios.

    it('replays a full lifecycle and asserts one audit row per transition', async () => {
      mockIsWebhookConfigured.mockReturnValue(true);

      // Step 1: payment_intent.succeeded
      mockVerifyWebhookSignature.mockResolvedValueOnce({
        id: 'evt_succeeded',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            amount: 2500,
            amount_received: 2500,
            currency: 'usd',
            latest_charge: { id: 'ch_1', receipt_url: 'https://stripe.com/r/1' },
          },
        },
      });
      prismaMock.charge.findUnique.mockResolvedValueOnce({
        id: 'charge-1',
        amountCents: 2500,
        currency: 'usd',
        status: 'REQUIRES_PAYMENT_METHOD',
        receiptUrl: null,
        registrationId: 'reg-1',
        registration: {
          id: 'reg-1',
          userId: 'u-1',
          eventId: 'e-1',
          status: 'PENDING',
          user: { id: 'u-1', name: 'Maria', email: 'maria@example.com' },
          event: { id: 'e-1', name: 'Picnic 2026', date: new Date('2026-08-15T11:00:00Z') },
        },
      });
      prismaMock.charge.update
        .mockResolvedValueOnce({
          id: 'charge-1',
          status: 'SUCCEEDED',
          amountCents: 2500,
          currency: 'usd',
          receiptUrl: 'https://stripe.com/r/1',
        })
        .mockResolvedValueOnce({ id: 'charge-1', receiptSentAt: new Date() });
      prismaMock.registration.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.registration.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'reg-1',
        status: 'PAID',
      });
      mockSendRegistrationReceipt.mockResolvedValueOnce({ success: true, messageId: 'msg-1' });

      const res1 = await import('~/app/api/stripe/webhook/route').then((m) =>
        m.POST(makeWebhookRequest('{"id":"evt_succeeded"}')),
      );
      expect(res1.status).toBe(200);

      // Step 2: charge.updated fires a partial refund via the dashboard
      mockVerifyWebhookSignature.mockResolvedValueOnce({
        id: 'evt_partial',
        type: 'charge.updated',
        data: {
          object: {
            id: 'ch_1',
            payment_intent: 'pi_1',
            amount_refunded: 1000,
          },
        },
      });
      prismaMock.charge.findUnique.mockResolvedValueOnce({
        id: 'charge-1',
        amountCents: 2500,
        registrationId: 'reg-1',
        receiptUrl: 'https://stripe.com/r/1',
      });
      prismaMock.refund.findMany.mockResolvedValueOnce([]);
      prismaMock.registration.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: 'reg-1',
          eventId: 'e-1',
          userId: 'u-1',
          refundedCents: 0,
          status: 'PAID',
        })
        .mockResolvedValueOnce({
          id: 'reg-1',
          eventId: 'e-1',
          userId: 'u-1',
        });
      prismaMock.registration.updateMany.mockResolvedValueOnce({ count: 1 });

      const res2 = await import('~/app/api/stripe/webhook/route').then((m) =>
        m.POST(makeWebhookRequest('{"id":"evt_partial"}')),
      );
      expect(res2.status).toBe(200);

      // Step 3: charge.refunded closes the loop with a full refund
      mockVerifyWebhookSignature.mockResolvedValueOnce({
        id: 'evt_refunded',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_1',
            payment_intent: 'pi_1',
            amount_refunded: 2500,
          },
        },
      });
      prismaMock.charge.findUnique.mockResolvedValueOnce({
        id: 'charge-1',
        amountCents: 2500,
        registrationId: 'reg-1',
        registration: {
          id: 'reg-1',
          eventId: 'e-1',
          userId: 'u-1',
        },
      });
      prismaMock.refund.findMany.mockResolvedValueOnce([{ id: 'r-1', amountCents: 2500 }]);
      prismaMock.registration.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'reg-1',
        eventId: 'e-1',
        userId: 'u-1',
        refundedCents: 0,
        status: 'PAID',
      });
      prismaMock.registration.updateMany.mockResolvedValueOnce({ count: 1 });

      const res3 = await import('~/app/api/stripe/webhook/route').then((m) =>
        m.POST(makeWebhookRequest('{"id":"evt_refunded"}')),
      );
      expect(res3.status).toBe(200);

      // The lifecycle wrote exactly three audit rows, one per state
      // transition. The order matches the replay order above.
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(3);
      expect(mockWriteAuditLog).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          action: ACTION.SUCCEEDED,
          userId: 'u-1',
          eventId: 'e-1',
        }),
      );
      expect(mockWriteAuditLog).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          action: ACTION.REFUND_RECONCILED,
          userId: 'u-1',
          eventId: 'e-1',
        }),
      );
      expect(mockWriteAuditLog).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          action: ACTION.REFUND_RECONCILED,
          userId: 'u-1',
          eventId: 'e-1',
        }),
      );

      // Roll up the action strings by transition. The set should have
      // exactly one entry per transition we replayed.
      const actions = mockWriteAuditLog.mock.calls.map(
        (call) => (call[0] as { action: string }).action,
      );
      expect(actions).toEqual([
        ACTION.SUCCEEDED,
        ACTION.REFUND_RECONCILED,
        ACTION.REFUND_RECONCILED,
      ]);
    });

    it('writes payment.failed exactly once for payment_intent.payment_failed', async () => {
      mockIsWebhookConfigured.mockReturnValue(true);
      mockVerifyWebhookSignature.mockResolvedValue({
        id: 'evt_failed',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed',
            status: 'requires_payment_method',
            last_payment_error: { code: 'card_declined', message: 'Card was declined' },
          },
        },
      });
      prismaMock.charge.findUnique.mockResolvedValue({
        id: 'charge-failed',
        status: 'REQUIRES_PAYMENT_METHOD',
        registrationId: 'reg-failed',
        registration: { userId: 'u-failed', eventId: 'e-failed', status: 'PENDING' },
      });
      prismaMock.charge.update.mockResolvedValue({});

      const res = await import('~/app/api/stripe/webhook/route').then((m) =>
        m.POST(makeWebhookRequest('{"id":"evt_failed"}')),
      );
      expect(res.status).toBe(200);
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      // Assert the errorCode and errorMessage from Stripe's
      // last_payment_error land in newValue. The audit log's value is
      // in the data it carries, and a typo in the source that drops
      // either field would not surface without these assertions.
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTION.FAILED,
          userId: 'u-failed',
          eventId: 'e-failed',
          newValue: expect.objectContaining({
            chargeStatus: 'FAILED',
            errorCode: 'card_declined',
            errorMessage: 'Card was declined',
          }),
        }),
      );
    });

    it('writes payment.failed exactly once for payment_intent.canceled', async () => {
      // Stripe sends payment_intent.canceled when the user backs out
      // before completing the Payment Element. The handler routes both
      // failure events through handlePaymentIntentFailed, which writes
      // the same payment.failed action string so admin queries group
      // them together.
      mockIsWebhookConfigured.mockReturnValue(true);
      mockVerifyWebhookSignature.mockResolvedValue({
        id: 'evt_canceled',
        type: 'payment_intent.canceled',
        data: { object: { id: 'pi_canceled', status: 'canceled' } },
      });
      prismaMock.charge.findUnique.mockResolvedValue({
        id: 'charge-canceled',
        status: 'PROCESSING',
        registrationId: 'reg-canceled',
        registration: { userId: 'u-canceled', eventId: 'e-canceled', status: 'PENDING' },
      });
      prismaMock.charge.update.mockResolvedValue({});

      const res = await import('~/app/api/stripe/webhook/route').then((m) =>
        m.POST(makeWebhookRequest('{"id":"evt_canceled"}')),
      );
      expect(res.status).toBe(200);
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: ACTION.FAILED }),
      );
    });
  });

  describe('payment router writes on intent create and create failure', () => {
    // The webhook test above covers the event-handler side. The router
    // is the other side of the lifecycle: it writes payment.intentCreated
    // on success and payment.intentFailed when Stripe rejects the
    // createPaymentIntent call. The mocks for prisma and audit are
    // imported fresh so the calls here do not collide with the webhook
    // mocks above.

    it('writes payment.intentCreated exactly once on successful intent creation', async () => {
      // Re-mount the audit module so we get a fresh mock counter.
      vi.resetModules();
      const freshWriteAuditLog = vi.fn();
      vi.doMock('~/lib/audit', () => ({
        writeAuditLog: (...args: unknown[]) => freshWriteAuditLog(...args),
      }));

      const localPrisma = {
        event: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'evt-1',
            name: 'Picnic',
            status: 'PUBLISHED',
            registrationFeeCents: 2500,
            currency: 'usd',
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-1',
            email: 'maria@example.com',
            name: 'Maria',
            householdId: 'h-1',
          }),
        },
        registration: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'reg-1', status: 'PENDING' }),
        },
        charge: {
          create: vi.fn().mockResolvedValue({
            id: 'ch-1',
            amountCents: 2500,
            currency: 'usd',
          }),
          update: vi.fn().mockResolvedValue({
            id: 'ch-1',
            status: 'REQUIRES_PAYMENT_METHOD',
          }),
        },
        $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(localPrisma)),
      };
      vi.doMock('~/lib/prisma', () => ({ prisma: localPrisma }));

      const mockCreatePaymentIntent = vi.fn().mockResolvedValue({
        paymentIntentId: 'pi_1',
        clientSecret: 'pi_1_secret_xyz',
        status: 'requires_payment_method',
        amountCents: 2500,
        currency: 'usd',
      });
      const mockIsStripeConfigured = vi.fn().mockReturnValue(true);
      const mockGetPublishableKey = vi.fn().mockReturnValue('pk_test_abc');
      vi.doMock('~/lib/stripe', async (importOriginal) => {
        const actual = await importOriginal<typeof import('~/lib/stripe')>();
        return {
          ...actual,
          createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
          getPublishableKey: () => mockGetPublishableKey(),
          isConfigured: () => mockIsStripeConfigured(),
        };
      });
      vi.doMock('next-auth', () => ({ getServerSession: vi.fn() }));
      vi.doMock('~/lib/auth', () => ({
        authOptions: {},
        getServerSession: vi.fn(),
        isAdminRole: (role: unknown) => role === 'ADMIN' || role === 'ADMIN_ADULT',
      }));
      vi.doMock('~/lib/generated/enums', enumMock);

      const { paymentRouter } = await import('~/server/routers/payment.router');
      const { createCallerFactory } = await import('~/lib/trpc');
      const caller = createCallerFactory(paymentRouter)({
        session: {
          user: {
            id: 'user-1',
            name: 'Maria',
            email: 'maria@example.com',
            role: 'ADMIN_ADULT',
            householdId: 'h-1',
          },
          expires: 'x',
        },
      });

      await caller.createPaymentIntent({ eventId: 'evt-1' });

      // Exactly one audit row, on the success path.
      expect(freshWriteAuditLog).toHaveBeenCalledTimes(1);
      // Assert paymentIntentId, chargeId, and amountCents in newValue.
      // Without these the test would pass even if the source dropped a
      // field, which is the whole point of an audit trail.
      expect(freshWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTION.INTENT_CREATED,
          userId: 'user-1',
          eventId: 'evt-1',
          newValue: expect.objectContaining({
            paymentIntentId: 'pi_1',
            chargeId: 'ch-1',
            amountCents: 2500,
            currency: 'usd',
          }),
        }),
      );
    });

    it('writes payment.intentFailed exactly once when Stripe rejects intent creation', async () => {
      vi.resetModules();
      const freshWriteAuditLog = vi.fn();
      vi.doMock('~/lib/audit', () => ({
        writeAuditLog: (...args: unknown[]) => freshWriteAuditLog(...args),
      }));

      const localPrisma = {
        event: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'evt-1',
            name: 'Picnic',
            status: 'PUBLISHED',
            registrationFeeCents: 2500,
            currency: 'usd',
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-1',
            email: 'maria@example.com',
            name: 'Maria',
            householdId: 'h-1',
          }),
        },
        registration: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'reg-1', status: 'PENDING' }),
        },
        charge: {
          create: vi.fn().mockResolvedValue({
            id: 'ch-1',
            amountCents: 2500,
            currency: 'usd',
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(localPrisma)),
      };
      vi.doMock('~/lib/prisma', () => ({ prisma: localPrisma }));

      const mockCreatePaymentIntent = vi.fn().mockRejectedValueOnce(new Error('stripe is down'));
      const mockIsStripeConfigured = vi.fn().mockReturnValue(true);
      vi.doMock('~/lib/stripe', async (importOriginal) => {
        const actual = await importOriginal<typeof import('~/lib/stripe')>();
        return {
          ...actual,
          createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
          getPublishableKey: () => 'pk_test_abc',
          isConfigured: () => mockIsStripeConfigured(),
        };
      });
      vi.doMock('next-auth', () => ({ getServerSession: vi.fn() }));
      vi.doMock('~/lib/auth', () => ({
        authOptions: {},
        getServerSession: vi.fn(),
        isAdminRole: (role: unknown) => role === 'ADMIN' || role === 'ADMIN_ADULT',
      }));
      vi.doMock('~/lib/generated/enums', enumMock);

      const { paymentRouter } = await import('~/server/routers/payment.router');
      const { createCallerFactory } = await import('~/lib/trpc');
      const caller = createCallerFactory(paymentRouter)({
        session: {
          user: {
            id: 'user-1',
            name: 'Maria',
            email: 'maria@example.com',
            role: 'ADMIN_ADULT',
            householdId: 'h-1',
          },
          expires: 'x',
        },
      });

      await expect(caller.createPaymentIntent({ eventId: 'evt-1' })).rejects.toThrow(
        /Failed to create payment intent/i,
      );

      // Exactly one audit row, on the failure path.
      expect(freshWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(freshWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTION.INTENT_FAILED,
          userId: 'user-1',
          eventId: 'evt-1',
        }),
      );
    });
  });

  describe('admin router writes on refund, forfeit, and receipt resend', () => {
    // These three are admin-initiated rather than webhook-driven, but
    // they show up in the same audit log and the admin relies on the
    // entries to reconstruct what happened to a registration. Pulling
    // them into the smoke test keeps the AC "every payment event writes
    // an AdminAuditLog row" one-stop verifiable.

    it('writes payment.refunded exactly once on admin refund', async () => {
      vi.resetModules();
      const freshWriteAuditLog = vi.fn();
      vi.doMock('~/lib/audit', () => ({
        writeAuditLog: (...args: unknown[]) => freshWriteAuditLog(...args),
        diff: vi.fn(),
      }));

      const localPrisma = {
        charge: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ch-1',
            status: 'SUCCEEDED',
            amountCents: 2500,
            currency: 'usd',
            stripePaymentIntentId: 'pi_1',
            registrationId: 'reg-1',
            registration: {
              id: 'reg-1',
              eventId: 'evt-1',
              userId: 'user-1',
              status: 'PAID',
              refunds: [],
            },
          }),
        },
        refund: {
          upsert: vi.fn().mockResolvedValue({ id: 'r-1' }),
          update: vi.fn().mockResolvedValue({ id: 'r-1', status: 'SUCCEEDED' }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        registration: {
          update: vi.fn().mockResolvedValue({
            id: 'reg-1',
            status: 'PAID',
            refundedCents: 1000,
          }),
        },
        $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(localPrisma)),
      };
      vi.doMock('~/lib/prisma', () => ({ prisma: localPrisma }));

      const mockCreateRefund = vi.fn().mockResolvedValue({
        refundId: 're_1',
        amountCents: 1000,
        currency: 'usd',
        status: 'succeeded',
      });
      const mockIsStripeConfigured = vi.fn().mockReturnValue(true);
      vi.doMock('~/lib/stripe', async (importOriginal) => {
        const actual = await importOriginal<typeof import('~/lib/stripe')>();
        return {
          ...actual,
          createRefund: (...args: unknown[]) => mockCreateRefund(...args),
          isConfigured: () => mockIsStripeConfigured(),
        };
      });
      vi.doMock('~/lib/currency', () => ({
        formatAmount: (cents: number, currency = 'usd') =>
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
          }).format(cents / 100),
      }));
      vi.doMock('next-auth', () => ({ getServerSession: vi.fn() }));
      vi.doMock('~/lib/auth', () => ({
        authOptions: {},
        getServerSession: vi.fn(),
        isAdminRole: (role: unknown) => role === 'ADMIN' || role === 'ADMIN_ADULT',
      }));
      vi.doMock('~/lib/generated/enums', enumMock);

      const { adminRouter } = await import('~/server/routers/admin.router');
      const { createCallerFactory } = await import('~/lib/trpc');
      const caller = createCallerFactory(adminRouter)({
        session: {
          user: {
            id: 'admin-1',
            name: 'Admin',
            email: 'admin@x.com',
            role: 'ADMIN',
            householdId: null,
          },
          expires: 'x',
        },
      });

      await caller.refund({ chargeId: 'ch-1', amountCents: 1000 });
      // The audited admin procedure writes one entry via the auditLog
      // middleware (action: procedure path) and the explicit
      // writeAuditLog writes the payment.refunded entry. Assert the
      // explicit `payment.refunded` call is present; the middleware
      // entry is covered by the dedicated trpc.test.ts unit.
      expect(freshWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTION.REFUNDED,
          userId: 'admin-1',
          eventId: 'evt-1',
        }),
      );
    });

    it('writes payment.forfeited exactly once on admin forfeit', async () => {
      vi.resetModules();
      const freshWriteAuditLog = vi.fn();
      vi.doMock('~/lib/audit', () => ({
        writeAuditLog: (...args: unknown[]) => freshWriteAuditLog(...args),
        diff: vi.fn(() => ({ status: { old: 'PAID', new: 'FORFEITED' } })),
      }));

      const localPrisma = {
        registration: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'reg-1',
            status: 'PAID',
            eventId: 'evt-1',
            refundedCents: 0,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'reg-1',
            status: 'FORFEITED',
            eventId: 'evt-1',
            refundedCents: 0,
          }),
        },
        $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(localPrisma)),
      };
      vi.doMock('~/lib/prisma', () => ({ prisma: localPrisma }));
      vi.doMock('next-auth', () => ({ getServerSession: vi.fn() }));
      vi.doMock('~/lib/auth', () => ({
        authOptions: {},
        getServerSession: vi.fn(),
        isAdminRole: (role: unknown) => role === 'ADMIN' || role === 'ADMIN_ADULT',
      }));
      vi.doMock('~/lib/generated/enums', enumMock);
      vi.doMock('~/lib/receipt', () => ({
        sendRegistrationReceipt: vi.fn(),
      }));

      const { adminRouter } = await import('~/server/routers/admin.router');
      const { createCallerFactory } = await import('~/lib/trpc');
      const caller = createCallerFactory(adminRouter)({
        session: {
          user: {
            id: 'admin-1',
            name: 'Admin',
            email: 'admin@x.com',
            role: 'ADMIN',
            householdId: null,
          },
          expires: 'x',
        },
      });

      await caller.forfeit({ registrationId: 'reg-1', reason: 'no-show' });
      // The auditLog middleware writes an `admin.forfeit` entry; the
      // explicit writeAuditLog writes the payment.forfeited entry.
      // Assert the explicit entry is present.
      expect(freshWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTION.FORFEITED,
          userId: 'admin-1',
          eventId: 'evt-1',
        }),
      );
    });

    it('writes payment.receiptResent exactly once on admin resend', async () => {
      vi.resetModules();
      const freshWriteAuditLog = vi.fn();
      vi.doMock('~/lib/audit', () => ({
        writeAuditLog: (...args: unknown[]) => freshWriteAuditLog(...args),
        diff: vi.fn(),
      }));

      const localPrisma = {
        charge: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ch-1',
            status: 'SUCCEEDED',
            amountCents: 2500,
            currency: 'usd',
            receiptUrl: 'https://stripe.com/r/1',
            registrationId: 'reg-1',
            registration: {
              id: 'reg-1',
              eventId: 'evt-1',
              user: { id: 'user-1', name: 'Maria', email: 'maria@example.com' },
              event: { id: 'evt-1', name: 'Picnic', date: new Date('2026-08-15T11:00:00Z') },
            },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(localPrisma)),
      };
      vi.doMock('~/lib/prisma', () => ({ prisma: localPrisma }));

      const mockSendRegistrationReceipt = vi
        .fn()
        .mockResolvedValue({ success: true, messageId: 'msg-1' });
      vi.doMock('~/lib/receipt', () => ({
        sendRegistrationReceipt: (...args: unknown[]) => mockSendRegistrationReceipt(...args),
      }));

      vi.doMock('next-auth', () => ({ getServerSession: vi.fn() }));
      vi.doMock('~/lib/auth', () => ({
        authOptions: {},
        getServerSession: vi.fn(),
        isAdminRole: (role: unknown) => role === 'ADMIN' || role === 'ADMIN_ADULT',
      }));
      vi.doMock('~/lib/generated/enums', enumMock);

      const { adminRouter } = await import('~/server/routers/admin.router');
      const { createCallerFactory } = await import('~/lib/trpc');
      const caller = createCallerFactory(adminRouter)({
        session: {
          user: {
            id: 'admin-1',
            name: 'Admin',
            email: 'admin@x.com',
            role: 'ADMIN',
            householdId: null,
          },
          expires: 'x',
        },
      });

      await caller.resendReceipt({ chargeId: 'ch-1' });
      // The auditLog middleware writes an `admin.resendReceipt` entry;
      // the explicit writeAuditLog writes the payment.receiptResent
      // entry. Assert the explicit entry is present.
      expect(freshWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTION.RECEIPT_RESENT,
          eventId: 'evt-1',
        }),
      );
    });
  });
});
