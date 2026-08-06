import { describe, it, expect } from 'vitest';
import { serializeCharge } from '../serialize';

describe('serializeCharge', () => {
  const now = new Date('2026-08-01T10:00:00Z');

  it('converts Date fields to ISO strings at every level', () => {
    const out = serializeCharge({
      id: 'c1',
      registrationId: 'r1',
      stripePaymentIntentId: 'pi_1',
      amountCents: 5000,
      currency: 'usd',
      status: 'SUCCEEDED',
      receiptUrl: null,
      receiptSentAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: now,
      updatedAt: now,
      registration: {
        id: 'r1',
        status: 'PAID',
        refundedCents: 0,
        createdAt: now,
        updatedAt: now,
        user: { id: 'u1', name: 'Alice', email: 'a@x.com' },
        event: { id: 'e1', name: 'Folia', date: now },
      },
      refunds: [
        {
          id: 'rf1',
          amountCents: 1000,
          currency: 'usd',
          status: 'SUCCEEDED',
          reason: 'customer request',
          createdAt: now,
          updatedAt: now,
          refundedBy: { id: 'a1', name: 'Admin' },
        },
      ],
    });

    expect(out.createdAt).toBe('2026-08-01T10:00:00.000Z');
    expect(out.updatedAt).toBe('2026-08-01T10:00:00.000Z');
    expect(out.receiptSentAt).toBe('2026-08-01T10:00:00.000Z');
    expect(out.registration.createdAt).toBe('2026-08-01T10:00:00.000Z');
    expect(out.registration.event.date).toBe('2026-08-01T10:00:00.000Z');
    expect(out.refunds[0]?.createdAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('preserves already-stringified timestamps unchanged', () => {
    const iso = '2026-08-01T10:00:00.000Z';
    const out = serializeCharge({
      id: 'c1',
      registrationId: 'r1',
      stripePaymentIntentId: 'pi_1',
      amountCents: 0,
      currency: 'usd',
      status: 'SUCCEEDED',
      receiptUrl: null,
      receiptSentAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: iso,
      updatedAt: iso,
      registration: {
        id: 'r1',
        status: 'PAID',
        refundedCents: 0,
        createdAt: iso,
        updatedAt: iso,
        user: { id: 'u1', name: 'Alice', email: 'a@x.com' },
        event: { id: 'e1', name: 'Folia', date: iso },
      },
      refunds: [],
    });

    expect(out.createdAt).toBe(iso);
    expect(out.receiptSentAt).toBeNull();
  });

  it('converts null receiptSentAt to null', () => {
    const out = serializeCharge({
      id: 'c1',
      registrationId: 'r1',
      stripePaymentIntentId: 'pi_1',
      amountCents: 0,
      currency: 'usd',
      status: 'SUCCEEDED',
      receiptUrl: null,
      receiptSentAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: now,
      updatedAt: now,
      registration: {
        id: 'r1',
        status: 'PENDING',
        refundedCents: 0,
        createdAt: now,
        updatedAt: now,
        user: { id: 'u1', name: 'Alice', email: 'a@x.com' },
        event: { id: 'e1', name: 'Folia', date: now },
      },
      refunds: [],
    });

    expect(out.receiptSentAt).toBeNull();
  });
});
