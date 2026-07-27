import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  invitation: { create: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn() },
  communicationLog: { create: vi.fn() },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { POST as POSTSend } from '~/app/api/admin/invitations/send/route';
import { POST as POSTResend } from '~/app/api/admin/invitations/resend/route';
import { POST as POSTTrack } from '~/app/api/admin/invitations/track/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/admin/invitations/send', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTSend(makeJsonRequest('http://x', { eventId: 'e-1', householdId: 'h-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTSend(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('creates invitation for a user', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.create.mockResolvedValue({ id: 'inv-1' } as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(makeJsonRequest('http://x', { eventId: 'e-1', userId: 'u-2' }));
    expect(res.status).toBe(200);
    expect(prismaMock.invitation.create).toHaveBeenCalled();
  });

  it('creates invitation for a household and queues communication for each member', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.create.mockResolvedValue({ id: 'inv-1' } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }, { id: 'u-3' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(
      makeJsonRequest('http://x', { eventId: 'e-1', householdId: 'h-1', channel: 'SMS' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.communicationLog.create).toHaveBeenCalledTimes(2);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.create.mockRejectedValue(new Error('boom'));
    const res = await POSTSend(makeJsonRequest('http://x', { eventId: 'e-1', userId: 'u-2' }));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/invitations/resend', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTResend(makeJsonRequest('http://x', { id: 'inv-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when id missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTResend(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('resets invitation and re-queues communications to household members', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.update.mockResolvedValue({
      id: 'inv-1',
      eventId: 'e-1',
      householdId: 'h-1',
      userId: null,
    } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }, { id: 'u-3' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTResend(makeJsonRequest('http://x', { id: 'inv-1' }));
    expect(res.status).toBe(200);
    expect(prismaMock.communicationLog.create).toHaveBeenCalledTimes(2);
  });

  it('re-queues to a single user when invitation has userId', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.update.mockResolvedValue({
      id: 'inv-1',
      eventId: 'e-1',
      householdId: null,
      userId: 'u-2',
    } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTResend(makeJsonRequest('http://x', { id: 'inv-1' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.update.mockRejectedValue(new Error('boom'));
    const res = await POSTResend(makeJsonRequest('http://x', { id: 'inv-1' }));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/invitations/track', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTTrack(makeJsonRequest('http://x', { id: 'inv-1', status: 'SENT' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTTrack(makeJsonRequest('http://x', { id: 'inv-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTTrack(makeJsonRequest('http://x', { id: 'inv-1', status: 'INVALID' }));
    expect(res.status).toBe(400);
  });

  it('updates invitation status to PENDING without setting sentAt', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'PENDING' } as never);
    const res = await POSTTrack(makeJsonRequest('http://x', { id: 'inv-1', status: 'PENDING' }));
    expect(res.status).toBe(200);
    expect(prismaMock.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', sentAt: undefined }),
      }),
    );
  });

  it('updates invitation status to SENT with sentAt timestamp', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'SENT' } as never);
    const res = await POSTTrack(makeJsonRequest('http://x', { id: 'inv-1', status: 'SENT' }));
    expect(res.status).toBe(200);
    expect(prismaMock.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT', sentAt: expect.any(Date) }),
      }),
    );
  });

  it('updates invitation status to DELIVERED with sentAt timestamp', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'DELIVERED' } as never);
    const res = await POSTTrack(makeJsonRequest('http://x', { id: 'inv-1', status: 'DELIVERED' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.invitation.update.mockRejectedValue(new Error('boom'));
    const res = await POSTTrack(makeJsonRequest('http://x', { id: 'inv-1', status: 'SENT' }));
    expect(res.status).toBe(500);
  });
});
