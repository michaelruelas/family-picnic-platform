import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  itineraryItem: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  event: { findUnique: vi.fn() },
  // FPP-65 audit: requireEventAdminApi consults canAccessEvent,
  // which reads eventAdmin.findUnique. The mock must expose it.
  eventAdmin: { findUnique: vi.fn(() => Promise.resolve(null)) },
  $transaction: vi.fn(),
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
import { POST } from '~/app/api/admin/itinerary-items/reorder/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/admin/itinerary-items/reorder', () => {
  it('returns 403 when caller has no admin role or EventAdmin row', async () => {
    // FPP-65 audit: GUEST has a session but no admin role and no
    // EventAdmin row — `requireEventAdminApi` returns 403, not 401.
    // 401 is reserved for missing sessions.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', itemIds: ['i-1'] }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when itemIds is empty', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', itemIds: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', itemIds: ['i-1'] }));
    expect(res.status).toBe(404);
  });

  it('returns 409 when the incoming list does not match the server', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.itineraryItem.findMany.mockResolvedValue([{ id: 'i-1' }, { id: 'i-2' }] as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', itemIds: ['i-1'] }));
    expect(res.status).toBe(409);
  });

  it('returns 409 when the incoming list contains an unknown id', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.itineraryItem.findMany.mockResolvedValue([{ id: 'i-1' }, { id: 'i-2' }] as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e-1', itemIds: ['i-1', 'i-2', 'i-3'] }),
    );
    expect(res.status).toBe(409);
  });

  it('rewrites the order to match the incoming list', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.itineraryItem.findMany.mockResolvedValue([
      { id: 'i-1' },
      { id: 'i-2' },
      { id: 'i-3' },
    ] as never);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({
        itineraryItem: { update: prismaMock.itineraryItem.update },
      });
    });
    prismaMock.itineraryItem.update.mockResolvedValue({} as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e-1', itemIds: ['i-3', 'i-1', 'i-2'] }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.itineraryItem.update).toHaveBeenCalledTimes(3);
    expect(prismaMock.itineraryItem.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'i-3' }, data: { order: 0 } }),
    );
    expect(prismaMock.itineraryItem.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 'i-1' }, data: { order: 1 } }),
    );
    expect(prismaMock.itineraryItem.update).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ where: { id: 'i-2' }, data: { order: 2 } }),
    );
  });

  it('returns 500 on Prisma error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', itemIds: ['i-1'] }));
    expect(res.status).toBe(500);
  });
});
