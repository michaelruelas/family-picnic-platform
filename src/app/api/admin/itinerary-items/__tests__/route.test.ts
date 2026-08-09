import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  itineraryItem: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  event: { findUnique: vi.fn() },
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
import { POST } from '~/app/api/admin/itinerary-items/route';
import { PATCH, DELETE } from '~/app/api/admin/itinerary-items/[id]/route';

const mockedSession = vi.mocked(getServerSession);

const itemParams = { params: Promise.resolve({ id: 'i-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/admin/itinerary-items', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', title: 'Setup' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', title: 'Setup' }));
    expect(res.status).toBe(404);
  });

  it('appends the new item at the next order', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.itineraryItem.aggregate.mockResolvedValue({ _max: { order: 2 } } as never);
    prismaMock.itineraryItem.create.mockResolvedValue({ id: 'i-new' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e-1',
        time: '10:00',
        title: 'Setup',
        description: 'Bring coolers.',
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.itineraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'e-1',
          time: '10:00',
          title: 'Setup',
          description: 'Bring coolers.',
          order: 3,
        }),
      }),
    );
  });

  it('starts the order at 0 when no items exist', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.itineraryItem.aggregate.mockResolvedValue({ _max: { order: null } } as never);
    prismaMock.itineraryItem.create.mockResolvedValue({ id: 'i-new' } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', title: 'Setup' }));
    expect(res.status).toBe(200);
    expect(prismaMock.itineraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 0 }),
      }),
    );
  });

  it('stores an empty time as null', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.itineraryItem.aggregate.mockResolvedValue({ _max: { order: 0 } } as never);
    prismaMock.itineraryItem.create.mockResolvedValue({ id: 'i-new' } as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e-1', title: 'Setup', time: '' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.itineraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ time: null }),
      }),
    );
  });

  it('returns 400 when time is malformed', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e-1', title: 'Setup', time: 'before lunch' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 on Prisma error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e-1', title: 'Setup' }));
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/itinerary-items/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await PATCH(makeJsonRequest('http://x', { title: 'New' }, 'PATCH'), itemParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when item not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.itineraryItem.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { title: 'New' }, 'PATCH'), itemParams);
    expect(res.status).toBe(404);
  });

  it('updates the title', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.itineraryItem.findUnique.mockResolvedValue({ id: 'i-1', eventId: 'e-1' } as never);
    prismaMock.itineraryItem.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { title: 'New' }, 'PATCH'), itemParams);
    expect(res.status).toBe(200);
    expect(prismaMock.itineraryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'i-1' },
        data: { title: 'New' },
      }),
    );
  });

  it('clears the time when an empty string is sent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.itineraryItem.findUnique.mockResolvedValue({ id: 'i-1', eventId: 'e-1' } as never);
    prismaMock.itineraryItem.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { time: '' }, 'PATCH'), itemParams);
    expect(res.status).toBe(200);
    expect(prismaMock.itineraryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'i-1' },
        data: { time: null },
      }),
    );
  });

  it('rejects an empty title', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await PATCH(makeJsonRequest('http://x', { title: '   ' }, 'PATCH'), itemParams);
    expect(res.status).toBe(400);
  });

  it('returns 500 on Prisma error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.itineraryItem.findUnique.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makeJsonRequest('http://x', { title: 'New' }, 'PATCH'), itemParams);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/admin/itinerary-items/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when item not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.itineraryItem.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(404);
  });

  it('deletes the item and re-packs the order', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.itineraryItem.findUnique.mockResolvedValue({
      id: 'i-1',
      eventId: 'e-1',
      order: 1,
    } as never);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({
        itineraryItem: {
          delete: prismaMock.itineraryItem.delete,
          findMany: prismaMock.itineraryItem.findMany,
          update: prismaMock.itineraryItem.update,
        },
      });
    });
    prismaMock.itineraryItem.delete.mockResolvedValue({} as never);
    // The endpoint deletes first, then re-fetches the remaining
    // rows. The just-deleted row must be absent from the returned
    // set so the re-pack loop only renumbers i-2 and i-3.
    prismaMock.itineraryItem.findMany.mockResolvedValue([{ id: 'i-2' }, { id: 'i-3' }] as never);
    prismaMock.itineraryItem.update.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(200);
    expect(prismaMock.itineraryItem.delete).toHaveBeenCalledWith({ where: { id: 'i-1' } });
    expect(prismaMock.itineraryItem.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.itineraryItem.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'i-2' }, data: { order: 0 } }),
    );
    expect(prismaMock.itineraryItem.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 'i-3' }, data: { order: 1 } }),
    );
  });

  it('returns 500 on Prisma error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.itineraryItem.findUnique.mockRejectedValue(new Error('boom'));
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(500);
  });
});
