import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findMany: vi.fn(), create: vi.fn() },
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
import { GET, POST } from '~/app/api/admin/events/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('GET /api/admin/events', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 401 when user is not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns events for admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findMany.mockResolvedValue([{ id: 'e-1', name: 'Picnic' }] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findMany.mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/events', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', { name: 'Picnic', date: '2026-01-01', location: 'Park' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(makeJsonRequest('http://x', { name: 'Picnic' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when rsvp deadline is after event date', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        name: 'Picnic',
        date: '2026-01-01',
        location: 'Park',
        rsvpDeadline: '2026-02-01',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when maxCapacity < 1', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        name: 'Picnic',
        date: '2026-01-01',
        location: 'Park',
        maxCapacity: 0,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('creates event in DRAFT status', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.create.mockResolvedValue({ id: 'e-new' } as never);
    const res = await POST(
      makeJsonRequest('http://x', { name: 'Picnic', date: '2026-01-01', location: 'Park' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT' }),
      }),
    );
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.create.mockRejectedValue(new Error('boom'));
    const res = await POST(
      makeJsonRequest('http://x', { name: 'Picnic', date: '2026-01-01', location: 'Park' }),
    );
    expect(res.status).toBe(500);
  });
});
