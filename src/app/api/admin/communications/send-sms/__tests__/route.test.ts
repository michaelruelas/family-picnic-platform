import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
  communicationLog: { create: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

const sendSMS = vi.fn();
vi.mock('~/lib/twilio', () => ({
  sendSMS: (...args: unknown[]) => sendSMS(...args),
  getFromPhoneNumber: () => '+15559876543',
  isValidE164: (value: unknown) => typeof value === 'string' && /^\+[1-9]\d{1,14}$/.test(value),
  isConfigured: () => true,
}));

vi.mock('~/lib/audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { POST } from '~/app/api/admin/communications/send-sms/route';

const mockedSession = vi.mocked(getServerSession);

function makeNextReq(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetPrismaMock(prismaMock);
  sendSMS.mockReset();
  vi.unstubAllEnvs();
});

describe('POST /api/admin/communications/send-sms', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'hi',
      }),
    );
    expect(res.status).toBe(401);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid input', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeNextReq('http://x', { eventId: 'e-1' }));
    expect(res.status).toBe(400);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 400 when message is empty', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: '   ',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when event is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'hi',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when recipient is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'hi',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when recipient has not granted SMS consent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '+15551234567',
      smsConsent: false,
    });
    prismaMock.communicationLog.create.mockResolvedValue({});
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'hi',
      }),
    );
    expect(res.status).toBe(403);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 422 when recipient has no valid phone on file', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: null,
      smsConsent: true,
    });
    prismaMock.communicationLog.create.mockResolvedValue({});
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'hi',
      }),
    );
    expect(res.status).toBe(422);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 422 when stored phone is not E.164', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '5551234567',
      smsConsent: true,
    });
    prismaMock.communicationLog.create.mockResolvedValue({});
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'hi',
      }),
    );
    expect(res.status).toBe(422);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('sends SMS, persists SENT log + audit entry on success', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    sendSMS.mockResolvedValue({ success: true, messageId: 'SMxyz' });
    prismaMock.communicationLog.create.mockResolvedValue({ id: 'cl-1' });

    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'Hello there',
      }),
    );
    expect(res.status).toBe(200);
    expect(sendSMS).toHaveBeenCalledWith({ to: '+15551234567', body: 'Hello there' });
    const createCall = prismaMock.communicationLog.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data).toMatchObject({
      eventId: 'e-1',
      sentByUserId: 'u-1',
      recipientUserId: 'u-2',
      channel: 'SMS',
      messageId: 'SMxyz',
      toPhoneNumber: '+15551234567',
      fromPhoneNumber: '+15559876543',
      status: 'SENT',
    });
    expect(createCall.data.deliveredAt).toBeInstanceOf(Date);
  });

  it('returns 502 and persists FAILED log on Twilio failure', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    sendSMS.mockResolvedValue({
      success: false,
      error: 'Twilio rejected the message',
      errorCode: 21610,
    });
    prismaMock.communicationLog.create.mockResolvedValue({ id: 'cl-2' });

    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'Hello there',
      }),
    );
    expect(res.status).toBe(502);
    const createCall = prismaMock.communicationLog.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data).toMatchObject({
      messageId: undefined,
      status: 'FAILED',
      errorCode: '21610',
      errorMessage: 'Twilio rejected the message',
      deliveredAt: null,
    });
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(
      makeNextReq('http://x', {
        eventId: 'e-1',
        recipientUserId: 'u-2',
        message: 'hi',
      }),
    );
    expect(res.status).toBe(500);
  });

  it('rejects a JSON body that is not parseable', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const req = new NextRequest('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
