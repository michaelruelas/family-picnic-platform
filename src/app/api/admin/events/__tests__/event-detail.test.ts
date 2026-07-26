import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers as Record<string, string>),
        },
      }),
  },
}));

import { getServerSession } from 'next-auth';
import { GET, PATCH, DELETE } from '~/app/api/admin/events/[id]/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  event: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function makePatchReq(body: unknown): Request {
  return new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [p.event.findUnique, p.event.update, p.event.delete]) {
    fn.mockReset();
  }
});

describe('GET /api/admin/events/[id]', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns event with related data', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await GET(new Request('http://x'), eventParams);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/events/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await PATCH(makePatchReq({ name: 'New' }), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ name: 'New' }), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 when deadline is after event date', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', date: new Date('2025-12-01') } as never);
    const res = await PATCH(
      makePatchReq({ date: '2025-01-01', rsvpDeadline: '2025-12-31' }),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when maxCapacity < 1', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    const res = await PATCH(makePatchReq({ maxCapacity: 0 }), eventParams);
    expect(res.status).toBe(400);
  });

  it('updates event with provided fields', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    p.event.update.mockResolvedValue({ id: 'e-1', name: 'New' } as never);
    const res = await PATCH(makePatchReq({ name: 'New' }), eventParams);
    expect(res.status).toBe(200);
    expect(p.event.update).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makePatchReq({ name: 'New' }), eventParams);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/admin/events/[id]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(404);
  });

  it('deletes the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    p.event.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(200);
    expect(p.event.delete).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    p.event.delete.mockRejectedValue(new Error('boom'));
    const res = await DELETE(new Request('http://x'), eventParams);
    expect(res.status).toBe(500);
  });
});
