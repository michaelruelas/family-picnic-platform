import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  invitation: { create: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn() },
  communicationLog: { create: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) },
      }),
  },
}));

import { getServerSession } from 'next-auth';
import { POST as POSTSend } from '~/app/api/admin/invitations/send/route';
import { POST as POSTResend } from '~/app/api/admin/invitations/resend/route';
import { POST as POSTTrack } from '~/app/api/admin/invitations/track/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  invitation: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  communicationLog: { create: ReturnType<typeof vi.fn> };
};

function makeReq(body: unknown): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.invitation.create,
    p.invitation.update,
    p.user.findMany,
    p.communicationLog.create,
  ]) {
    fn.mockReset();
  }
});

describe('POST /api/admin/invitations/send', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTSend(makeReq({ eventId: 'e-1', householdId: 'h-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTSend(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('creates invitation for a user', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.create.mockResolvedValue({ id: 'inv-1' } as never);
    p.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(makeReq({ eventId: 'e-1', userId: 'u-2' }));
    expect(res.status).toBe(200);
    expect(p.invitation.create).toHaveBeenCalled();
  });

  it('creates invitation for a household and queues communication for each member', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.create.mockResolvedValue({ id: 'inv-1' } as never);
    p.user.findMany.mockResolvedValue([{ id: 'u-2' }, { id: 'u-3' }] as never);
    p.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(
      makeReq({ eventId: 'e-1', householdId: 'h-1', channel: 'SMS' }),
    );
    expect(res.status).toBe(200);
    expect(p.communicationLog.create).toHaveBeenCalledTimes(2);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.create.mockRejectedValue(new Error('boom'));
    const res = await POSTSend(makeReq({ eventId: 'e-1', userId: 'u-2' }));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/invitations/resend', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTResend(makeReq({ id: 'inv-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when id missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTResend(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('resets invitation and re-queues communications to household members', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.update.mockResolvedValue({
      id: 'inv-1',
      eventId: 'e-1',
      householdId: 'h-1',
      userId: null,
    } as never);
    p.user.findMany.mockResolvedValue([{ id: 'u-2' }, { id: 'u-3' }] as never);
    p.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTResend(makeReq({ id: 'inv-1' }));
    expect(res.status).toBe(200);
    expect(p.communicationLog.create).toHaveBeenCalledTimes(2);
  });

  it('re-queues to a single user when invitation has userId', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.update.mockResolvedValue({
      id: 'inv-1',
      eventId: 'e-1',
      householdId: null,
      userId: 'u-2',
    } as never);
    p.user.findMany.mockResolvedValue([{ id: 'u-2' }] as never);
    p.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTResend(makeReq({ id: 'inv-1' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.update.mockRejectedValue(new Error('boom'));
    const res = await POSTResend(makeReq({ id: 'inv-1' }));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/invitations/track', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTTrack(makeReq({ id: 'inv-1', status: 'SENT' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTTrack(makeReq({ id: 'inv-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTTrack(makeReq({ id: 'inv-1', status: 'INVALID' }));
    expect(res.status).toBe(400);
  });

  it('updates invitation status to PENDING without setting sentAt', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'PENDING' } as never);
    const res = await POSTTrack(makeReq({ id: 'inv-1', status: 'PENDING' }));
    expect(res.status).toBe(200);
    expect(p.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', sentAt: undefined }),
      }),
    );
  });

  it('updates invitation status to SENT with sentAt timestamp', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'SENT' } as never);
    const res = await POSTTrack(makeReq({ id: 'inv-1', status: 'SENT' }));
    expect(res.status).toBe(200);
    expect(p.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT', sentAt: expect.any(Date) }),
      }),
    );
  });

  it('updates invitation status to DELIVERED with sentAt timestamp', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'DELIVERED' } as never);
    const res = await POSTTrack(makeReq({ id: 'inv-1', status: 'DELIVERED' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.invitation.update.mockRejectedValue(new Error('boom'));
    const res = await POSTTrack(makeReq({ id: 'inv-1', status: 'SENT' }));
    expect(res.status).toBe(500);
  });
});
