import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  eventAdmin: { findUnique: vi.fn(), delete: vi.fn() },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    NextResponse: actual.NextResponse,
    NextRequest: actual.NextRequest,
  };
});

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { DELETE } from '~/app/api/admin/events/[id]/admins/[userId]/route';

const mockedSession = vi.mocked(getServerSession);
const adminParams = { params: Promise.resolve({ id: 'e-1', userId: 'u-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('DELETE /api/admin/events/[id]/admins/[userId]', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when admin not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue(null);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(404);
  });

  it('removes admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.eventAdmin.delete.mockResolvedValue({} as never);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(200);
  });
});
