import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
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

const writeAuditLog = vi.fn();
vi.mock('~/lib/audit', () => ({ writeAuditLog: (...args: unknown[]) => writeAuditLog(...args) }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { POST } from '~/app/api/admin/sms/send/route';

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
  writeAuditLog.mockReset();
  vi.unstubAllEnvs();
});

describe('POST /api/admin/sms/send', () => {
  it('returns 401 when caller is not an admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: 'hi' }));
    expect(res.status).toBe(401);
    expect(sendSMS).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (missing userId)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeNextReq('http://x', { body: 'hi' }));
    expect(res.status).toBe(400);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 400 when body is empty', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: '   ' }));
    expect(res.status).toBe(400);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 400 when body exceeds 320 chars', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: 'x'.repeat(321) }));
    expect(res.status).toBe(400);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 404 when recipient is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: 'hi' }));
    expect(res.status).toBe(404);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 403 and writes audit entry when recipient has not granted SMS consent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '+15551234567',
      smsConsent: false,
    });
    prismaMock.communicationLog.create.mockResolvedValue({ id: 'cl-no-consent' });
    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: 'hi', eventId: 'e-1' }));
    expect(res.status).toBe(403);
    expect(sendSMS).not.toHaveBeenCalled();
    expect(prismaMock.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'NO_CONSENT',
        }),
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sms.send',
        newValue: expect.objectContaining({ status: 'REJECTED', error: 'NO_CONSENT' }),
      }),
    );
  });

  it('returns 422 and writes audit entry when recipient has no valid E.164 phone on file', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '5551234567',
      smsConsent: true,
    });
    prismaMock.communicationLog.create.mockResolvedValue({ id: 'cl-no-phone' });
    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: 'hi', eventId: 'e-1' }));
    expect(res.status).toBe(422);
    expect(sendSMS).not.toHaveBeenCalled();
    expect(prismaMock.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'NO_PHONE',
        }),
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sms.send',
        newValue: expect.objectContaining({ status: 'REJECTED', error: 'NO_PHONE' }),
      }),
    );
  });

  it('sends SMS, writes SENT log and audit entry on success with eventId', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    sendSMS.mockResolvedValue({ success: true, messageId: 'SMxyz' });
    prismaMock.communicationLog.create.mockResolvedValue({ id: 'cl-1' });

    const res = await POST(
      makeNextReq('http://x', { userId: 'u-2', body: 'Hi there', eventId: 'e-1' }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.messageId).toBe('SMxyz');
    expect(sendSMS).toHaveBeenCalledWith({ to: '+15551234567', body: 'Hi there' });
    expect(prismaMock.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'e-1',
          recipientUserId: 'u-2',
          channel: 'SMS',
          status: 'SENT',
          messageId: 'SMxyz',
        }),
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sms.send',
        userId: 'u-1',
        eventId: 'e-1',
        oldValue: { recipientUserId: 'u-2', channel: 'SMS' },
        newValue: expect.objectContaining({ status: 'SENT', messageId: 'SMxyz' }),
      }),
    );
  });

  it('sends SMS without writing CommunicationLog when eventId is omitted', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    sendSMS.mockResolvedValue({ success: true, messageId: 'SMxyz' });

    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: 'Hi there' }));
    expect(res.status).toBe(200);
    expect(prismaMock.communicationLog.create).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sms.send',
        userId: 'u-1',
        eventId: undefined,
      }),
    );
  });

  it('returns 502 and writes FAILED log + audit entry on Twilio failure', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
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
      makeNextReq('http://x', { userId: 'u-2', body: 'Hi there', eventId: 'e-1' }),
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(prismaMock.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: '21610',
          errorMessage: 'Twilio rejected the message',
        }),
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sms.send',
        newValue: expect.objectContaining({
          status: 'FAILED',
          error: 'Twilio rejected the message',
          errorCode: '21610',
        }),
      }),
    );
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeNextReq('http://x', { userId: 'u-2', body: 'hi' }));
    expect(res.status).toBe(500);
  });

  it('rejects a body that is not parseable JSON', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const req = new NextRequest('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(sendSMS).not.toHaveBeenCalled();
  });
});
