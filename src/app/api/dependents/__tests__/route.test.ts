import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  dependent: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: { findUnique: vi.fn() },
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
import { GET, POST, PATCH, DELETE } from '~/app/api/dependents/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  dependent: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeReq(url: string, body?: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.dependent.findMany,
    p.dependent.findUnique,
    p.dependent.create,
    p.dependent.update,
    p.user.findUnique,
  ]) {
    fn.mockReset();
  }
});

describe('GET /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns dependents list', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findMany.mockResolvedValue([{ id: 'd-1', name: 'Kid' }] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findMany.mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeReq('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq('http://x', { name: '', relationship: 'FROB' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(404);
  });

  it('creates a dependent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.dependent.create.mockResolvedValue({ id: 'd-1', name: 'Kid' } as never);
    const res = await POST(makeReq('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('d-1');
  });

  it('falls back to user.id when householdId is null', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: null } as never);
    p.dependent.create.mockResolvedValue({ id: 'd-1' } as never);
    const res = await POST(makeReq('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(201);
    expect(p.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ householdId: 'u-1' }) }),
    );
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeReq('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await PATCH(makeReq('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await PATCH(makeReq('http://x', {}, 'PATCH'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when dependent not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the manager', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'someone-else',
      deletedAt: null,
    } as never);
    const res = await PATCH(makeReq('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(403);
  });

  it('returns 200 when only id is provided (zod makes other fields optional)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: null,
    } as never);
    p.dependent.update.mockResolvedValue({ id: 'd-1' } as never);
    const res = await PATCH(makeReq('http://x', { id: 'd-1' }, 'PATCH'));
    expect(res.status).toBe(200);
  });

  it('updates a dependent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: null,
    } as never);
    p.dependent.update.mockResolvedValue({ id: 'd-1', name: 'New' } as never);
    const res = await PATCH(makeReq('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(200);
  });

  it('returns 404 when dependent is soft-deleted', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: new Date(),
    } as never);
    const res = await PATCH(makeReq('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await DELETE(makeReq('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await DELETE(makeReq('http://x', undefined, 'DELETE'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when dependent not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the manager', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'someone-else',
      deletedAt: null,
    } as never);
    const res = await DELETE(makeReq('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(403);
  });

  it('soft-deletes a dependent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: null,
    } as never);
    p.dependent.update.mockResolvedValue({} as never);
    const res = await DELETE(makeReq('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(p.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });
});
