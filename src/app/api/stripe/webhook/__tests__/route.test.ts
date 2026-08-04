import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';

const prismaMock = vi.hoisted(() => ({
  charge: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  registration: {
    update: vi.fn(),
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
    prismaMock.registration.update.mockResolvedValue({
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
    });
    prismaMock.refund.findMany.mockResolvedValue([{ id: 'r-1', amountCents: 2500 }]);
    prismaMock.registration.update.mockResolvedValue({});

    const res = await POST(makeWebhookRequest('{"id":"evt_4"}'));
    expect(res.status).toBe(200);
    expect(prismaMock.registration.update).toHaveBeenCalledWith({
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
    prismaMock.registration.update.mockResolvedValue({});
    mockSendRegistrationReceipt.mockResolvedValue({ success: false, error: 'sendgrid down' });

    const res = await POST(makeWebhookRequest('{"id":"evt_7"}'));
    expect(res.status).toBe(200);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.succeeded' }),
    );
  });
});
