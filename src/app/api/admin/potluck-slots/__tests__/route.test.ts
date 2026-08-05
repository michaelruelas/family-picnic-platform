import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  potluckSlot: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { findUnique: vi.fn() },
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
import { POST } from '~/app/api/admin/potluck-slots/route';
import { PATCH, DELETE } from '~/app/api/admin/potluck-slots/[id]/route';

const mockedSession = vi.mocked(getServerSession);

const slotParams = { params: Promise.resolve({ id: 's-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/admin/potluck-slots', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('FPP-54: creates a slot without a name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({
      id: 's-1',
      name: null,
    } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'DESSERT',
        slotType: 'UNLIMITED',
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.potluckSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'e1',
          category: 'DESSERT',
          name: null,
          slotType: 'UNLIMITED',
        }),
      }),
    );
  });

  it('FPP-54: trims whitespace-only name to null', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'DESSERT',
        slotType: 'UNLIMITED',
        name: '   ',
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.potluckSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: null }),
      }),
    );
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for LIMITED slot without maxSignups', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'LIMITED',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('creates an OPEN slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('creates a LIMITED slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'LIMITED',
        maxSignups: 5,
      }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/potluck-slots/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when slot not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(404);
  });

  it('updates slot name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('FPP-54: clears slot name when an empty string is sent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: '' }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
    expect(prismaMock.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's-1' },
        data: { name: null },
      }),
    );
  });

  it('returns 400 when LIMITED slot has maxSignups < 1', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's-1',
      slotType: 'LIMITED',
    } as never);
    const res = await PATCH(makeJsonRequest('http://x', { maxSignups: 0 }, 'PATCH'), slotParams);
    expect(res.status).toBe(400);
  });

  it('updates maxSignups for LIMITED slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's-1',
      slotType: 'LIMITED',
    } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { maxSignups: 10 }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('ignores maxSignups for OPEN slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { maxSignups: 10 }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/admin/potluck-slots/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when slot not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(404);
  });

  it('deletes the slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1' } as never);
    prismaMock.potluckSlot.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1' } as never);
    prismaMock.potluckSlot.delete.mockRejectedValue(new Error('boom'));
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(500);
  });
});
