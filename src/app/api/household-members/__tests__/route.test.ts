import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  householdMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: { findUnique: vi.fn() },
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
import { POST } from '~/app/api/household-members/route';
import { PATCH, DELETE } from '~/app/api/household-members/[id]/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/household-members', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { householdId: 'h-1', name: 'Alex' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { householdId: 'h-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when householdId is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { name: 'Alex' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when age is out of range', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', { householdId: 'h-1', name: 'Alex', age: 200 }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not in the target household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-2' } as never);
    const res = await POST(makeJsonRequest('http://x', { householdId: 'h-1', name: 'Alex' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when user has no household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: null } as never);
    const res = await POST(makeJsonRequest('http://x', { householdId: 'h-1', name: 'Alex' }));
    expect(res.status).toBe(403);
  });

  it('creates a member with trimmed name and null notes', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.create.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      name: 'Alex',
      age: 7,
      notes: null,
    } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        householdId: 'h-1',
        name: '  Alex  ',
        age: 7,
        notes: '   ',
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Alex');
    expect(prismaMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Alex', age: 7, notes: null }),
      }),
    );
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', { householdId: 'h-1', name: 'Alex' }));
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/household-members/[id]', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x/m-1', { name: 'Alex', id: 'm-1' }, 'PATCH'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when member is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x/m-1', { name: 'Alex' }, 'PATCH'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when member is soft-deleted', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: new Date(),
    } as never);
    const res = await PATCH(makeJsonRequest('http://x/m-1', { name: 'Alex' }, 'PATCH'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is in a different household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-2' } as never);
    const res = await PATCH(makeJsonRequest('http://x/m-1', { name: 'Alex' }, 'PATCH'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when no valid fields to update', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    const res = await PATCH(makeJsonRequest('http://x/m-1', {}, 'PATCH'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('updates the member with trimmed name and age', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.update.mockResolvedValue({
      id: 'm-1',
      name: 'Alex Garcia',
      age: 8,
    } as never);
    const res = await PATCH(
      makeJsonRequest('http://x/m-1', { name: '  Alex Garcia  ', age: 8 }, 'PATCH'),
      { params: Promise.resolve({ id: 'm-1' }) },
    );
    expect(res.status).toBe(200);
    expect(prismaMock.householdMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-1' },
        data: { name: 'Alex Garcia', age: 8 },
      }),
    );
  });

  it('stores null when notes cleared to empty string', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.update.mockResolvedValue({ id: 'm-1', notes: null } as never);
    const res = await PATCH(makeJsonRequest('http://x/m-1', { notes: '   ' }, 'PATCH'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(200);
    expect(prismaMock.householdMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: null }),
      }),
    );
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makeJsonRequest('http://x/m-1', { name: 'Alex' }, 'PATCH'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/household-members/[id]', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when member is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when member is soft-deleted', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: new Date(),
    } as never);
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is in a different household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-2' } as never);
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when only one member remains', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.count.mockResolvedValue(1);
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(400);
    expect(prismaMock.householdMember.update).not.toHaveBeenCalled();
  });

  it('soft-deletes the member when more than one remain', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue({
      id: 'm-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.count.mockResolvedValue(2);
    prismaMock.householdMember.update.mockResolvedValue({} as never);
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prismaMock.householdMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-1' },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.householdMember.findUnique.mockRejectedValue(new Error('boom'));
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'), {
      params: Promise.resolve({ id: 'm-1' }),
    });
    expect(res.status).toBe(500);
  });
});
