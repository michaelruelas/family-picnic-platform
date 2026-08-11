import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  // FPP-104: the new per-event gate calls `canAccessEvent`, which
  // reads `eventAdmin.findUnique` for non-platform-admins. Stub
  // it to `null` so the test stays focused on the route's own
  // 401/404/400 behaviour; per-event access for the GUEST role
  // is the subject of `src/lib/__tests__/event-access.test.ts`.
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
import { GET, PATCH, DELETE } from '~/app/api/admin/events/[id]/route';

const mockedSession = vi.mocked(getServerSession);

const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
  // Default to "no EventAdmin row" so non-admin users hit the
  // 403 path. Tests that exercise a HOST override this.
  prismaMock.eventAdmin.findUnique.mockResolvedValue(null);
});

describe('GET /api/admin/events/[id]', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 401 when not admin', async () => {
    // FPP-104: GET is intentionally global-admin only (hosts use
    // the dedicated event-edit page which already routes through
    // `requireEventAdminPage` and ships the per-event payload).
    // A HOST calling this route is not gated by `canAccessEvent`
    // and gets the same 401 as a GUEST.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns event with related data', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/events/[id]', () => {
  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    // FPP-104: per-event gate. A session exists but the user has
    // no admin role and no EventAdmin row, so the gate returns
    // 403 (not 401). 401 is reserved for missing sessions.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), eventParams);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no session at all', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 when deadline is after event date', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e-1',
      date: new Date('2025-12-01'),
    } as never);
    const res = await PATCH(
      makeJsonRequest('http://x', { date: '2025-01-01', rsvpDeadline: '2025-12-31' }, 'PATCH'),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when maxCapacity < 1', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    const res = await PATCH(makeJsonRequest('http://x', { maxCapacity: 0 }, 'PATCH'), eventParams);
    expect(res.status).toBe(400);
  });

  it('updates event with provided fields', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1', name: 'New' } as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), eventParams);
    expect(res.status).toBe(200);
    expect(prismaMock.event.update).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), eventParams);
    expect(res.status).toBe(500);
  });

  it('FPP-104: allows a HOST with an EventAdmin row to PATCH the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1', name: 'New' } as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), eventParams);
    expect(res.status).toBe(200);
  });

  it('FPP-104: rejects a HOST with no EventAdmin row for this event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), eventParams);
    expect(res.status).toBe(403);
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/events/[id]', () => {
  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    // FPP-104: per-event gate. Same 403-on-existing-session
    // contract as PATCH.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no session at all', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(404);
  });

  it('deletes the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(200);
    expect(prismaMock.event.delete).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.delete.mockRejectedValue(new Error('boom'));
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(500);
  });

  it('FPP-104: allows a HOST with an EventAdmin row to DELETE the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(200);
  });
});
