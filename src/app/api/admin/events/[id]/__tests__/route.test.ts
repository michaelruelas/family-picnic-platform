import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  // FPP-104: per-event gate consults canAccessEvent.
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
import { PATCH } from '~/app/api/admin/events/[id]/route';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('PATCH /api/admin/events/[id] (FPP-60 featuredImageUrl)', () => {
  it('persists a valid featuredImageUrl', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1' } as never);
    const res = await PATCH(
      makeJsonRequest(
        'http://x',
        { featuredImageUrl: 'https://cdn.example.com/hero.jpg' },
        'PATCH',
      ),
      eventParams,
    );
    expect(res.status).toBe(200);
    expect(prismaMock.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e-1' },
        data: expect.objectContaining({
          featuredImageUrl: 'https://cdn.example.com/hero.jpg',
        }),
      }),
    );
  });

  it('collapses an empty-string featuredImageUrl to null on update', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1' } as never);
    const res = await PATCH(
      makeJsonRequest('http://x', { featuredImageUrl: '' }, 'PATCH'),
      eventParams,
    );
    expect(res.status).toBe(200);
    expect(prismaMock.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ featuredImageUrl: null }),
      }),
    );
  });

  it('rejects a non-URL featuredImageUrl', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    const res = await PATCH(
      makeJsonRequest('http://x', { featuredImageUrl: 'not-a-url' }, 'PATCH'),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('does not touch featuredImageUrl when omitted from the patch', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1' } as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'Renamed' }, 'PATCH'), eventParams);
    expect(res.status).toBe(200);
    const lastCall = prismaMock.event.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect('featuredImageUrl' in lastCall.data).toBe(false);
  });
});
