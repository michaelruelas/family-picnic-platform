import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn() },
  // FPP-104: the per-event gate consults canAccessEvent, which
  // reads `eventAdmin.findUnique` for non-platform-admins. Stub
  // it to `null` so the test stays focused on the route's own
  // behaviour; per-event access for the GUEST role is the
  // subject of `src/lib/__tests__/event-access.test.ts`.
  eventAdmin: { findUnique: vi.fn(() => Promise.resolve(null)) },
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
import { POST } from '~/app/api/admin/events/[id]/publish/route';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/admin/events/[id]/publish', () => {
  it('returns 401 when no session at all', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    // FPP-104: per-event gate. A session exists but the user has
    // no admin role and no EventAdmin row, so the gate returns
    // 403 (not 401). 401 is reserved for missing sessions.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(403);
  });

  it('FPP-104: allows a HOST with an EventAdmin row to publish the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'DRAFT' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is not DRAFT', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(400);
  });

  it('publishes a DRAFT event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'DRAFT' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(500);
  });
});
