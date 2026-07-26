import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn() },
  eventAdmin: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) =>
        new Response(JSON.stringify(body), {
          status: init?.status ?? 200,
          headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) },
        }),
    },
  };
});

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { POST as POSTPublish } from '~/app/api/admin/events/[id]/publish/route';
import { POST as POSTClose } from '~/app/api/admin/events/[id]/close/route';
import { POST as POSTCancel } from '~/app/api/admin/events/[id]/cancel/route';
import { POST as POSTAddAdmin } from '~/app/api/admin/events/[id]/admins/route';
import { DELETE as DeleteAdmin } from '~/app/api/admin/events/[id]/admins/[userId]/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  event: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  eventAdmin: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function makeReq(body?: unknown): NextRequest {
  return new NextRequest('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const eventParams = { params: Promise.resolve({ id: 'e-1' }) };
const adminParams = { params: Promise.resolve({ id: 'e-1', userId: 'u-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.event.findUnique,
    p.event.update,
    p.eventAdmin.findUnique,
    p.eventAdmin.create,
    p.eventAdmin.delete,
  ]) {
    fn.mockReset();
  }
});

describe('POST /api/admin/events/[id]/publish', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTPublish(makeReq(), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POSTPublish(makeReq(), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is not DRAFT', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POSTPublish(makeReq(), eventParams);
    expect(res.status).toBe(400);
  });

  it('publishes a DRAFT event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'DRAFT' } as never);
    p.event.update.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POSTPublish(makeReq(), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POSTPublish(makeReq(), eventParams);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/events/[id]/close', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTClose(makeReq(), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POSTClose(makeReq(), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is not PUBLISHED', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'DRAFT' } as never);
    const res = await POSTClose(makeReq(), eventParams);
    expect(res.status).toBe(400);
  });

  it('closes a PUBLISHED event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    p.event.update.mockResolvedValue({ id: 'e-1', status: 'CLOSED' } as never);
    const res = await POSTClose(makeReq(), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POSTClose(makeReq(), eventParams);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/events/[id]/cancel', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTCancel(makeReq(), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 400 when event is CLOSED', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'CLOSED' } as never);
    const res = await POSTCancel(makeReq(), eventParams);
    expect(res.status).toBe(400);
  });

  it('cancels a non-CLOSED event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'DRAFT' } as never);
    p.event.update.mockResolvedValue({ id: 'e-1', status: 'CANCELLED' } as never);
    const res = await POSTCancel(makeReq(), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POSTCancel(makeReq(), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POSTCancel(makeReq(), eventParams);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/events/[id]/admins', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await POSTAddAdmin(makeReq({ userId: 'u-2' }), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 400 when userId missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POSTAddAdmin(makeReq({}), eventParams);
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POSTAddAdmin(makeReq({ userId: 'u-2' }), eventParams);
    expect(res.status).toBe(404);
  });

  it('returns 409 when user is already an admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    p.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    const res = await POSTAddAdmin(makeReq({ userId: 'u-2' }), eventParams);
    expect(res.status).toBe(409);
  });

  it('adds a new admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    p.eventAdmin.findUnique.mockResolvedValue(null);
    p.eventAdmin.create.mockResolvedValue({ id: 'ea-1' } as never);
    const res = await POSTAddAdmin(makeReq({ userId: 'u-2', role: 'COADMIN' }), eventParams);
    expect(res.status).toBe(201);
  });

  it('uses default COADMIN role when role not provided', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    p.eventAdmin.findUnique.mockResolvedValue(null);
    p.eventAdmin.create.mockResolvedValue({ id: 'ea-1' } as never);
    const res = await POSTAddAdmin(makeReq({ userId: 'u-2' }), eventParams);
    expect(res.status).toBe(201);
    expect(p.eventAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'COADMIN' }) }),
    );
  });
});

describe('DELETE /api/admin/events/[id]/admins/[userId]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    const res = await DeleteAdmin(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when admin not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.eventAdmin.findUnique.mockResolvedValue(null);
    const res = await DeleteAdmin(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(404);
  });

  it('removes admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    p.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    p.eventAdmin.delete.mockResolvedValue({} as never);
    const res = await DeleteAdmin(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(200);
  });
});
