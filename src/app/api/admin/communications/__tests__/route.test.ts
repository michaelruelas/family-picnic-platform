import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  communicationLog: { findMany: vi.fn(), create: vi.fn() },
  scheduledBroadcast: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('~/lib/ow-client', () => ({
  getOpenWorkflow: vi.fn().mockResolvedValue({ runWorkflow: vi.fn() }),
}));

vi.mock('~/lib/ow-workflows', () => ({
  scheduledBroadcastDelivery: { spec: { name: 'scheduled-broadcast' } },
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { POST as POSTSend } from '~/app/api/admin/communications/send/route';
import { GET as GETStatus } from '~/app/api/admin/communications/status/route';
import { GET as GETProcess } from '~/app/api/admin/communications/process-scheduled/route';

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
  delete process.env.CRON_SECRET;
});

describe('POST /api/admin/communications/send', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POSTSend(
      makeNextReq('http://x', {
        eventId: 'e-1',
        message: 'Hi',
        channel: 'EMAIL',
        recipientType: 'ALL',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POSTSend(makeNextReq('http://x', { eventId: 'e-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid scheduledAt', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POSTSend(
      makeNextReq('http://x', {
        eventId: 'e-1',
        message: 'Hi',
        channel: 'EMAIL',
        recipientType: 'ALL',
        scheduledAt: 'invalid',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('schedules a broadcast with valid scheduledAt', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.scheduledBroadcast.create.mockResolvedValue({
      id: 'sb-1',
      scheduledAt: new Date('2026-12-01'),
    } as never);
    const res = await POSTSend(
      makeNextReq('http://x', {
        eventId: 'e-1',
        message: 'Hi',
        channel: 'EMAIL',
        recipientType: 'ALL',
        scheduledAt: '2026-12-01T00:00:00Z',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scheduled).toBe(true);
  });

  it('sends to ALL recipients immediately', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }, { id: 'u-3' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(
      makeNextReq('http://x', {
        eventId: 'e-1',
        message: 'Hi',
        channel: 'EMAIL',
        recipientType: 'ALL',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          communicationPreference: { in: ['EMAIL', 'BOTH'] },
        }),
      }),
    );
  });

  it('applies SMS+BOTH preference filter for SMS channel', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(
      makeNextReq('http://x', {
        eventId: 'e-1',
        message: 'Hi',
        channel: 'SMS',
        recipientType: 'ALL',
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          communicationPreference: { in: ['SMS', 'BOTH'] },
        }),
      }),
    );
  });

  it('sends to NOT_RESPONDED recipients', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(
      makeNextReq('http://x', {
        eventId: 'e-1',
        message: 'Hi',
        channel: 'EMAIL',
        recipientType: 'NOT_RESPONDED',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 for HOUSEHOLD without recipientIds', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POSTSend(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: 'e-1',
          message: 'Hi',
          channel: 'EMAIL',
          recipientType: 'HOUSEHOLD',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for INDIVIDUAL without recipientIds', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POSTSend(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: 'e-1',
          message: 'Hi',
          channel: 'EMAIL',
          recipientType: 'INDIVIDUAL',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('sends to HOUSEHOLD recipients', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: 'e-1',
          message: 'Hi',
          channel: 'EMAIL',
          recipientType: 'HOUSEHOLD',
          recipientIds: ['h-1'],
        }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it('sends to INDIVIDUAL recipients', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const res = await POSTSend(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: 'e-1',
          message: 'Hi',
          channel: 'EMAIL',
          recipientType: 'INDIVIDUAL',
          recipientIds: ['u-2', 'u-3'],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.user.findMany.mockRejectedValue(new Error('boom'));
    const res = await POSTSend(
      makeNextReq('http://x', {
        eventId: 'e-1',
        message: 'Hi',
        channel: 'EMAIL',
        recipientType: 'ALL',
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/communications/status', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await GETStatus(new NextRequest('http://x?eventId=e-1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when eventId missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await GETStatus(new NextRequest('http://x'));
    expect(res.status).toBe(400);
  });

  it('returns logs', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.communicationLog.findMany.mockResolvedValue([{ id: 'log-1' }] as never);
    const res = await GETStatus(new NextRequest('http://x?eventId=e-1'));
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.communicationLog.findMany.mockRejectedValue(new Error('boom'));
    const res = await GETStatus(new NextRequest('http://x?eventId=e-1'));
    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/communications/process-scheduled', () => {
  it('returns 401 when CRON_SECRET is set but auth header is wrong', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const req = new NextRequest('http://x', { headers: { authorization: 'Bearer wrong' } });
    const res = await GETProcess(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is set and no auth header', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const req = new NextRequest('http://x');
    const res = await GETProcess(req);
    expect(res.status).toBe(401);
  });

  it('processes when auth header matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'test-secret';
    prismaMock.scheduledBroadcast.findMany.mockResolvedValue([] as never);
    const req = new NextRequest('http://x', { headers: { authorization: 'Bearer test-secret' } });
    const res = await GETProcess(req);
    expect(res.status).toBe(200);
  });

  it('processes when CRON_SECRET is not configured', async () => {
    prismaMock.scheduledBroadcast.findMany.mockResolvedValue([] as never);
    const req = new NextRequest('http://x');
    const res = await GETProcess(req);
    expect(res.status).toBe(200);
  });

  it('processes ALL recipient type broadcast', async () => {
    prismaMock.scheduledBroadcast.findMany.mockResolvedValue([
      {
        id: 'sb-1',
        eventId: 'e-1',
        recipientType: 'ALL',
        recipientIds: [],
        sentByUserId: 'u-1',
        channel: 'EMAIL',
      },
    ] as never);
    prismaMock.scheduledBroadcast.update.mockResolvedValue({} as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-2' }] as never);
    prismaMock.communicationLog.create.mockResolvedValue({} as never);
    const req = new NextRequest('http://x');
    const res = await GETProcess(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
  });

  it('handles per-broadcast failure', async () => {
    prismaMock.scheduledBroadcast.findMany.mockResolvedValue([
      { id: 'sb-1', eventId: 'e-1', recipientType: 'ALL' },
    ] as never);
    prismaMock.scheduledBroadcast.update
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({} as never);
    const req = new NextRequest('http://x');
    const res = await GETProcess(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.results[0].status).toBe('FAILED');
  });

  it('returns 500 on top-level error', async () => {
    prismaMock.scheduledBroadcast.findMany.mockRejectedValue(new Error('boom'));
    const req = new NextRequest('http://x');
    const res = await GETProcess(req);
    expect(res.status).toBe(500);
  });
});
