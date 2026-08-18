import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';

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

import { NextRequest } from 'next/server';
import { POST } from '~/app/api/stripe/webhook/route';

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

describe('POST /api/stripe/webhook', () => {
  it('returns 503 when STRIPE_WEBHOOK_SECRET is not set', async () => {
    mockIsWebhookConfigured.mockReturnValue(false);
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(503);
    expect(mockVerifyWebhookSignature).not.toHaveBeenCalled();
  });

  it('returns 400 when signature header is missing', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    const res = await POST(makeWebhookRequest('{}', null));
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature verification fails', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockRejectedValue(new Error('bad signature'));
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(400);
  });

  it('handles payment_intent.succeeded: updates charge to SUCCEEDED, sends receipt, writes audit', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_1',
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
    prismaMock.charge.findUnique.mockResolvedValue({
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
    prismaMock.registration.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.registration.findUniqueOrThrow.mockResolvedValue({
      id: 'reg-1',
      status: 'PAID',
    });
    mockSendRegistrationReceipt.mockResolvedValue({ success: true, messageId: 'msg-1' });

    const res = await POST(makeWebhookRequest('{"id":"evt_1"}'));
    expect(res.status).toBe(200);
    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith({
      payload: '{"id":"evt_1"}',
      signatureHeader: 't=1,v1=abc',
    });
    expect(prismaMock.charge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'charge-1' },
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.succeeded',
        userId: 'u-1',
        eventId: 'e-1',
      }),
    );
    expect(mockSendRegistrationReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'maria@example.com',
        amountCents: 2500,
        eventUrl: 'http://localhost:3000/events/e-1',
      }),
    );
  });

  it('handles payment_intent.payment_failed: marks charge FAILED with error details', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_2',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_2',
          status: 'requires_payment_method',
          last_payment_error: { code: 'card_declined', message: 'Card was declined' },
        },
      },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-2',
      status: 'REQUIRES_PAYMENT_METHOD',
      registrationId: 'reg-2',
      registration: { userId: 'u-2', eventId: 'e-2', status: 'PENDING' },
    });
    prismaMock.charge.update.mockResolvedValue({});

    const res = await POST(makeWebhookRequest('{"id":"evt_2"}'));
    expect(res.status).toBe(200);
    expect(prismaMock.charge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          lastErrorCode: 'card_declined',
          lastErrorMessage: 'Card was declined',
        }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.failed' }),
    );
  });

  it('handles payment_intent.canceled: marks charge CANCELED', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_3',
      type: 'payment_intent.canceled',
      data: { object: { id: 'pi_3', status: 'canceled' } },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-3',
      status: 'PROCESSING',
      registrationId: 'reg-3',
      registration: { userId: 'u-3', eventId: 'e-3', status: 'PENDING' },
    });
    prismaMock.charge.update.mockResolvedValue({});

    const res = await POST(makeWebhookRequest('{"id":"evt_3"}'));
    expect(res.status).toBe(200);
    expect(prismaMock.charge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELED' }) }),
    );
  });

  it('handles charge.refunded: syncs refundedCents and sets registration to REFUNDED when full', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_4',
      type: 'charge.refunded',
      data: { object: { id: 'ch_4', payment_intent: 'pi_4' } },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-4',
      amountCents: 2500,
      registrationId: 'reg-4',
      registration: {
        id: 'reg-4',
        eventId: 'e-4',
        userId: 'u-4',
      },
    });
    prismaMock.refund.findMany.mockResolvedValue([{ id: 'r-1', amountCents: 2500 }]);
    prismaMock.registration.findUniqueOrThrow.mockResolvedValue({
      id: 'reg-4',
      eventId: 'e-4',
      userId: 'u-4',
      refundedCents: 0,
      status: 'PAID',
    });
    prismaMock.registration.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeWebhookRequest('{"id":"evt_4"}'));
    expect(res.status).toBe(200);
    expect(prismaMock.registration.updateMany).toHaveBeenCalledWith({
      where: { id: 'reg-4' },
      data: { refundedCents: 2500, status: 'REFUNDED' },
    });
  });

  it('handles charge.updated: persists receipt URL when first seen', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_5',
      type: 'charge.updated',
      data: {
        object: { id: 'ch_5', payment_intent: 'pi_5', receipt_url: 'https://stripe.com/r/5' },
      },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-5',
      receiptUrl: null,
    });
    prismaMock.charge.update.mockResolvedValue({});

    const res = await POST(makeWebhookRequest('{"id":"evt_5"}'));
    expect(res.status).toBe(200);
    expect(prismaMock.charge.update).toHaveBeenCalledWith({
      where: { id: 'charge-5' },
      data: { receiptUrl: 'https://stripe.com/r/5' },
    });
  });

  it('handles charge.updated: reconciles partial OOB refund via amount_refunded', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_partial',
      type: 'charge.updated',
      data: {
        object: {
          id: 'ch_partial',
          payment_intent: 'pi_partial',
          amount_refunded: 1000, // partial refund via Stripe dashboard
        },
      },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-partial',
      amountCents: 2500,
      registrationId: 'reg-partial',
      receiptUrl: 'https://stripe.com/r/already',
    });
    prismaMock.refund.findMany.mockResolvedValue([]); // no in-app refunds
    prismaMock.registration.findUniqueOrThrow.mockResolvedValue({
      id: 'reg-partial',
      eventId: 'e-partial',
      userId: 'u-partial',
      refundedCents: 0,
      status: 'PAID',
    });
    prismaMock.registration.updateMany.mockResolvedValue({ count: 1 });
    // The audit path needs userId/eventId; handleChargeUpdated fetches
    // them from the registration after reconcileRefundedAmount returns.
    prismaMock.registration.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'reg-partial',
      eventId: 'e-partial',
      userId: 'u-partial',
      refundedCents: 0,
      status: 'PAID',
    });

    const res = await POST(makeWebhookRequest('{"id":"evt_partial"}'));
    expect(res.status).toBe(200);
    // Partial refund: refundedCents = 1000, registration stays PAID
    // (1000 < 2500). Writes a refundReconciled audit entry.
    expect(prismaMock.registration.updateMany).toHaveBeenCalledWith({
      where: { id: 'reg-partial' },
      data: { refundedCents: 1000 },
    });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.refundReconciled',
        newValue: expect.objectContaining({
          refundedCents: 1000,
          registrationStatus: 'PAID',
          isFullRefund: false,
          stripeRefundedCents: 1000,
          localRefundedCents: 0,
          source: 'out_of_band',
        }),
      }),
    );
  });

  it('handles charge.refunded: writes payment.refundReconciled audit log', async () => {
    // Closes F6: the existing charge.refunded test only checked the
    // registration update; the audit log entry was untested.
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_refunded_audit',
      type: 'charge.refunded',
      data: { object: { id: 'ch_ref', payment_intent: 'pi_ref' } },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-ref',
      amountCents: 2500,
      registrationId: 'reg-ref',
      registration: {
        id: 'reg-ref',
        eventId: 'e-ref',
        userId: 'u-ref',
      },
    });
    prismaMock.refund.findMany.mockResolvedValue([{ id: 'r-1', amountCents: 2500 }]);
    prismaMock.registration.findUniqueOrThrow.mockResolvedValue({
      id: 'reg-ref',
      eventId: 'e-ref',
      userId: 'u-ref',
      refundedCents: 0,
      status: 'PAID',
    });
    prismaMock.registration.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeWebhookRequest('{"id":"evt_refunded_audit"}'));
    expect(res.status).toBe(200);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.refundReconciled',
        userId: 'u-ref',
        eventId: 'e-ref',
        oldValue: expect.objectContaining({
          refundedCents: 0,
          registrationStatus: 'PAID',
        }),
        newValue: expect.objectContaining({
          refundedCents: 2500,
          registrationStatus: 'REFUNDED',
          isFullRefund: true,
          stripeRefundedCents: 0,
          localRefundedCents: 2500,
          source: 'in_app',
        }),
      }),
    );
  });

  it('returns 200 with received: true for unhandled event types', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_6',
      type: 'customer.updated',
      data: { object: { id: 'cus_1' } },
    });
    const res = await POST(makeWebhookRequest('{"id":"evt_6"}'));
    expect(res.status).toBe(200);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('continues to mark charge SUCCEEDED when receipt email fails', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_7',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_7',
          amount: 1000,
          amount_received: 1000,
          currency: 'usd',
          latest_charge: 'ch_7',
        },
      },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-7',
      amountCents: 1000,
      currency: 'usd',
      status: 'REQUIRES_PAYMENT_METHOD',
      receiptUrl: null,
      registrationId: 'reg-7',
      registration: {
        id: 'reg-7',
        userId: 'u-7',
        eventId: 'e-7',
        status: 'PENDING',
        user: { id: 'u-7', name: 'A', email: 'a@x.com' },
        event: { id: 'e-7', name: 'P', date: new Date('2026-08-15T11:00:00Z') },
      },
    });
    prismaMock.charge.update.mockResolvedValue({});
    prismaMock.registration.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.registration.findUniqueOrThrow.mockResolvedValue({
      id: 'reg-7',
      status: 'PAID',
    });
    mockSendRegistrationReceipt.mockResolvedValue({ success: false, error: 'twilio email down' });

    const res = await POST(makeWebhookRequest('{"id":"evt_7"}'));
    expect(res.status).toBe(200);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.succeeded' }),
    );
  });

  it('skips receipt + audit on payment_intent.succeeded retry when charge is already SUCCEEDED', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_retry',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_retry' } },
    });
    // Charge is already SUCCEEDED — Stripe is replaying the event.
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-retry',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'usd',
      receiptUrl: 'https://stripe.com/r/already',
      registrationId: 'reg-retry',
      registration: {
        id: 'reg-retry',
        userId: 'u-retry',
        eventId: 'e-retry',
        status: 'PAID',
        user: { id: 'u-retry', name: 'A', email: 'a@x.com' },
        event: { id: 'e-retry', name: 'E', date: new Date('2026-08-15T11:00:00Z') },
      },
    });

    const res = await POST(makeWebhookRequest('{"id":"evt_retry"}'));
    expect(res.status).toBe(200);
    // Critical: no duplicate audit entry, no duplicate receipt email.
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
    expect(mockSendRegistrationReceipt).not.toHaveBeenCalled();
  });

  it('does not resurrect a FORFEITED registration when payment_intent.succeeded fires late', async () => {
    // Closes F2: the registration status guard on updateMany must
    // skip the PAID transition when the admin already closed the
    // registration as FORFEITED (or REFUNDED). Charge status must NOT
    // be SUCCEEDED here -- that would trip the retry-dedup early return
    // before the guard runs. Use REQUIRES_PAYMENT_METHOD so the handler
    // reaches the status-update path.
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_forfeit_guard',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_forfeit_guard',
          amount: 2500,
          amount_received: 2500,
          currency: 'usd',
          latest_charge: { id: 'ch_forfeit_guard' },
        },
      },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-forfeit-guard',
      status: 'REQUIRES_PAYMENT_METHOD',
      amountCents: 2500,
      currency: 'usd',
      receiptUrl: null,
      registrationId: 'reg-forfeit-guard',
      registration: {
        id: 'reg-forfeit-guard',
        userId: 'u-fg',
        eventId: 'e-fg',
        status: 'FORFEITED',
        user: { id: 'u-fg', name: 'A', email: 'a@x.com' },
        event: { id: 'e-fg', name: 'E', date: new Date('2026-08-15T11:00:00Z') },
      },
    });
    // updateMany with status guard returns count: 0 — no rows match.
    prismaMock.registration.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeWebhookRequest('{"id":"evt_forfeit_guard"}'));
    expect(res.status).toBe(200);
    // No audit log entry (we don't claim the FORFEITED was ours).
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
    // No receipt email — the user forfeited, we don't spam them.
    expect(mockSendRegistrationReceipt).not.toHaveBeenCalled();
  });

  it('uses charge.amount_refunded from Stripe for charge.refunded (out-of-band dashboard refund)', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_oob',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_oob',
          payment_intent: 'pi_oob',
          amount_refunded: 5000, // out-of-band refund via Stripe dashboard
        },
      },
    });
    prismaMock.charge.findUnique.mockResolvedValue({
      id: 'charge-oob',
      amountCents: 5000,
      registrationId: 'reg-oob',
      registration: {
        id: 'reg-oob',
        eventId: 'e-oob',
        userId: 'u-oob',
      },
    });
    // No local Refund rows — the refund happened in the Stripe dashboard,
    // not via admin.refund. Old code would have computed totalRefunded=0
    // and clobbered refundedCents.
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.registration.findUniqueOrThrow.mockResolvedValue({
      id: 'reg-oob',
      eventId: 'e-oob',
      userId: 'u-oob',
      refundedCents: 0,
      status: 'PAID',
    });
    prismaMock.registration.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeWebhookRequest('{"id":"evt_oob"}'));
    expect(res.status).toBe(200);
    expect(prismaMock.registration.updateMany).toHaveBeenCalledWith({
      where: { id: 'reg-oob' },
      data: { refundedCents: 5000, status: 'REFUNDED' },
    });
  });

  it('returns 200 (not 500) when a handler throws, so Stripe does not retry the failed path', async () => {
    mockIsWebhookConfigured.mockReturnValue(true);
    mockVerifyWebhookSignature.mockResolvedValue({
      id: 'evt_explode',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_explode' } },
    });
    prismaMock.charge.findUnique.mockRejectedValue(new Error('db exploded'));

    const res = await POST(makeWebhookRequest('{"id":"evt_explode"}'));
    expect(res.status).toBe(200);
    // Body still acknowledges receipt so Stripe does not retry.
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
