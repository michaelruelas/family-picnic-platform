import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  potluckSlot: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { findUnique: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) },
      }),
  },
}));

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/admin/potluck-slots/route';
import { PATCH, DELETE } from '~/app/api/admin/potluck-slots/[id]/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  potluckSlot: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  event: { findUnique: ReturnType<typeof vi.fn> };
};

function makeReq(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const slotParams = { params: Promise.resolve({ id: 's-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.potluckSlot.create,
    p.potluckSlot.findUnique,
    p.potluckSlot.update,
    p.potluckSlot.delete,
    p.event.findUnique,
  ]) {
    fn.mockReset();
  }
});

describe('POST /api/admin/potluck-slots', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POST(
      makeReq({ eventId: 'e1', category: 'Main', name: 'Salad', slotType: 'OPEN' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(makeReq({ eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeReq({ eventId: 'e1', category: 'Main', name: 'Salad', slotType: 'OPEN' }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for LIMITED slot without maxSignups', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    const res = await POST(
      makeReq({ eventId: 'e1', category: 'Main', name: 'Salad', slotType: 'LIMITED' }),
    );
    expect(res.status).toBe(400);
  });

  it('creates an OPEN slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    p.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeReq({ eventId: 'e1', category: 'Main', name: 'Salad', slotType: 'OPEN' }),
    );
    expect(res.status).toBe(200);
  });

  it('creates a LIMITED slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    p.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeReq({
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
    p.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(
      makeReq({ eventId: 'e1', category: 'Main', name: 'Salad', slotType: 'OPEN' }),
    );
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/potluck-slots/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await PATCH(makeReq({ name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when slot not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(404);
  });

  it('updates slot name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    p.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeReq({ name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('returns 400 when LIMITED slot has maxSignups < 1', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'LIMITED' } as never);
    const res = await PATCH(makeReq({ maxSignups: 0 }, 'PATCH'), slotParams);
    expect(res.status).toBe(400);
  });

  it('updates maxSignups for LIMITED slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'LIMITED' } as never);
    p.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeReq({ maxSignups: 10 }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('ignores maxSignups for OPEN slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    p.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeReq({ maxSignups: 10 }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makeReq({ name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/admin/potluck-slots/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when slot not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(404);
  });

  it('deletes the slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({ id: 's-1' } as never);
    p.potluckSlot.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.potluckSlot.findUnique.mockRejectedValue(new Error('boom'));
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(500);
  });
});
