import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  event: { findUnique: vi.fn() },
  adminAuditLog: { findMany: vi.fn(), create: vi.fn() },
  household: { create: vi.fn() },
  rSVP: { create: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    NextResponse: actual.NextResponse,
    NextRequest: actual.NextRequest,
  };
});

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { GET as GETSearch } from '~/app/api/admin/users/search/route';
import { GET as GETAudit } from '~/app/api/admin/audit-log/route';
import { POST as POSTCsv } from '~/app/api/admin/csv-import/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  event: { findUnique: ReturnType<typeof vi.fn> };
  adminAuditLog: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  household: { create: ReturnType<typeof vi.fn> };
  rSVP: { create: ReturnType<typeof vi.fn> };
};

function makeReq(url: string, body?: unknown, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.user.findUnique,
    p.user.create,
    p.user.update,
    p.event.findUnique,
    p.adminAuditLog.findMany,
    p.adminAuditLog.create,
    p.household.create,
    p.rSVP.create,
  ]) {
    fn.mockReset();
  }
});

describe('GET /api/admin/users/search', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await GETSearch(makeReq('http://x?email=a@b.com', undefined, 'GET'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when email missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await GETSearch(makeReq('http://x', undefined, 'GET'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.user.findUnique.mockResolvedValue(null);
    const res = await GETSearch(makeReq('http://x?email=a@b.com', undefined, 'GET'));
    expect(res.status).toBe(404);
  });

  it('returns user with household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.user.findUnique.mockResolvedValue({
      id: 'u-2',
      name: 'Alice',
      email: 'a@b.com',
      household: { name: 'The Smiths' },
    } as never);
    const res = await GETSearch(makeReq('http://x?email=a@b.com', undefined, 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('u-2');
  });
});

describe('GET /api/admin/audit-log', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await GETAudit(makeReq('http://x', undefined, 'GET'));
    expect(res.status).toBe(401);
  });

  it('returns logs without filters', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.adminAuditLog.findMany.mockResolvedValue([{ id: 'log-1' }] as never);
    const res = await GETAudit(makeReq('http://x', undefined, 'GET'));
    expect(res.status).toBe(200);
  });

  it('passes through filter params', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.adminAuditLog.findMany.mockResolvedValue([] as never);
    const res = await GETAudit(
      makeReq('http://x?eventId=e-1&userId=u-1&action=CREATE', undefined, 'GET'),
    );
    expect(res.status).toBe(200);
    expect(p.adminAuditLog.findMany).toHaveBeenCalled();
  });
});

describe('POST /api/admin/csv-import', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTCsv(
      makeReq('http://x', { eventId: 'e-1', households: [] }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTCsv(makeReq('http://x', { eventId: 123 }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POSTCsv(
      makeReq('http://x', { eventId: 'e-1', households: [], dryRun: true }),
    );
    expect(res.status).toBe(404);
  });

  it('returns dry run result without writing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    const res = await POSTCsv(
      makeReq('http://x', {
        eventId: 'e-1',
        households: [
          { name: 'Smiths', members: [{ email: 'a@b.com', name: 'Alice', headcount: 1 }] },
        ],
        dryRun: true,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Dry run successful');
    expect(body.householdsCreated).toBe(1);
    expect(p.household.create).not.toHaveBeenCalled();
  });

  it('imports households with new and existing users', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    p.household.create.mockResolvedValue({ id: 'h-1' } as never);
    p.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'u-new' } as never)
      .mockResolvedValueOnce({ id: 'u-existing' } as never)
      .mockResolvedValueOnce({ id: 'u-existing' } as never);
    p.user.create.mockResolvedValue({ id: 'u-new' } as never);
    p.user.update.mockResolvedValue({} as never);
    p.rSVP.create.mockResolvedValue({} as never);
    p.adminAuditLog.create.mockResolvedValue({} as never);
    const res = await POSTCsv(
      makeReq('http://x', {
        eventId: 'e-1',
        households: [
          {
            name: 'Smiths',
            members: [
              { email: 'a@b.com', name: 'Alice', headcount: 1 },
              { email: 'c@d.com', name: 'Bob', headcount: 2 },
            ],
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(p.household.create).toHaveBeenCalledTimes(1);
    expect(p.user.create).toHaveBeenCalledTimes(1);
    expect(p.user.update).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POSTCsv(
      makeReq('http://x', { eventId: 'e-1', households: [], dryRun: true }),
    );
    expect(res.status).toBe(500);
  });
});
