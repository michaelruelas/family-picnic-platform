import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetPrismaMock } from 'tests/helpers/route';

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

function makeNextReq(url: string, body: unknown, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('GET /api/admin/users/search', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await GETSearch(new NextRequest('http://x?email=a@b.com', { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when email missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await GETSearch(new NextRequest('http://x', { method: 'GET' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GETSearch(new NextRequest('http://x?email=a@b.com', { method: 'GET' }));
    expect(res.status).toBe(404);
  });

  it('returns user with household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-2',
      name: 'Alice',
      email: 'a@b.com',
      household: { name: 'The Smiths' },
    } as never);
    const res = await GETSearch(new NextRequest('http://x?email=a@b.com', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('u-2');
  });
});

describe('GET /api/admin/audit-log', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await GETAudit(new NextRequest('http://x', { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('returns logs without filters', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.adminAuditLog.findMany.mockResolvedValue([{ id: 'log-1' }] as never);
    const res = await GETAudit(new NextRequest('http://x', { method: 'GET' }));
    expect(res.status).toBe(200);
  });

  it('passes through filter params', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.adminAuditLog.findMany.mockResolvedValue([] as never);
    const res = await GETAudit(
      new NextRequest('http://x?eventId=e-1&userId=u-1&action=CREATE', { method: 'GET' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.adminAuditLog.findMany).toHaveBeenCalled();
  });
});

describe('POST /api/admin/csv-import', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POSTCsv(makeNextReq('http://x', { eventId: 'e-1', households: [] }, 'POST'));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTCsv(makeNextReq('http://x', { eventId: 123 }, 'POST'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POSTCsv(
      makeNextReq('http://x', { eventId: 'e-1', households: [], dryRun: true }, 'POST'),
    );
    expect(res.status).toBe(404);
  });

  it('returns dry run result without writing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    const res = await POSTCsv(
      makeNextReq(
        'http://x',
        {
          eventId: 'e-1',
          households: [
            { name: 'Smiths', members: [{ email: 'a@b.com', name: 'Alice', headcount: 1 }] },
          ],
          dryRun: true,
        },
        'POST',
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Dry run successful');
    expect(body.householdsCreated).toBe(1);
    expect(prismaMock.household.create).not.toHaveBeenCalled();
  });

  it('imports households with new and existing users', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.household.create.mockResolvedValue({ id: 'h-1' } as never);
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'u-new' } as never)
      .mockResolvedValueOnce({ id: 'u-existing' } as never)
      .mockResolvedValueOnce({ id: 'u-existing' } as never);
    prismaMock.user.create.mockResolvedValue({ id: 'u-new' } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.rSVP.create.mockResolvedValue({} as never);
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);
    const res = await POSTCsv(
      makeNextReq(
        'http://x',
        {
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
        },
        'POST',
      ),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.household.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POSTCsv(
      makeNextReq('http://x', { eventId: 'e-1', households: [], dryRun: true }, 'POST'),
    );
    expect(res.status).toBe(500);
  });
});
