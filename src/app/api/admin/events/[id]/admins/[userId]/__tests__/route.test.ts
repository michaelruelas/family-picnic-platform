import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => {
  // FPP-65 audit: the DELETE handler now runs in a $transaction
  // deleting the EventAdmin row and (if role was OWNER) un-stamping
  // the user. The mock needs to expose every delegate the handler
  // can reach.
  return {
    eventAdmin: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(() => Promise.resolve(0)),
    },
    user: {
      updateManyAndReturn: vi.fn(() => Promise.resolve([])),
    },
    $transaction: vi.fn(),
    auditLog: { create: vi.fn() },
  };
});
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    NextResponse: actual.NextResponse,
    NextRequest: actual.NextRequest,
  };
});

vi.mock('~/lib/logger', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  generateRequestId: () => 'req-test',
}));

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { DELETE } from '~/app/api/admin/events/[id]/admins/[userId]/route';

const mockedSession = vi.mocked(getServerSession);
const adminParams = { params: Promise.resolve({ id: 'e-1', userId: 'u-1' }) };

// FPP-65 audit: the new route wraps the delete + un-stamp in a
// $transaction so the audit log and the role demotion are atomic.
function mockTransaction() {
  prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
    if (typeof ops === 'function') {
      return (ops as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    return Promise.all(ops as Promise<unknown>[]);
  });
}

beforeEach(() => {
  resetPrismaMock(prismaMock);
  mockTransaction();
});

describe('DELETE /api/admin/events/[id]/admins/[userId]', () => {
  it('returns 403 when caller has no admin role or EventAdmin row', async () => {
    // FPP-65 audit: GUEST has a session but no admin role and no
    // EventAdmin row — `requireEventAdminApi` returns 403, not 401.
    // 401 is reserved for missing sessions.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(403);
  });

  it('returns 401 when no session at all', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when admin not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue(null);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(404);
  });

  it('removes admin (COADMIN row → no un-stamp)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.eventAdmin.delete.mockResolvedValue({ role: 'COADMIN' } as never);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(200);
    // COADMIN removal must not call unassignHostRole (the user
    // still has HOST role elsewhere or never had it).
    expect(prismaMock.eventAdmin.count).not.toHaveBeenCalled();
    expect(prismaMock.user.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('removes OWNER row and un-stamps the user when no OWNER rows remain', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.eventAdmin.delete.mockResolvedValue({ role: 'OWNER' } as never);
    prismaMock.eventAdmin.count.mockResolvedValue(0);
    prismaMock.user.updateManyAndReturn.mockResolvedValue([{ id: 'u-1' }] as never);
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(200);
    // unassignHostRole fires the count + the demotion update.
    expect(prismaMock.eventAdmin.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u-1', role: 'OWNER' }) }),
    );
    expect(prismaMock.user.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1', role: 'HOST' },
        data: { role: 'ADMIN_ADULT' },
      }),
    );
  });

  it('removes OWNER row but skips un-stamp when more OWNER rows remain', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.eventAdmin.delete.mockResolvedValue({ role: 'OWNER' } as never);
    prismaMock.eventAdmin.count.mockResolvedValue(1); // other OWNER row exists
    const res = await DELETE(new NextRequest('http://x'), adminParams);
    expect(res.status).toBe(200);
    expect(prismaMock.eventAdmin.count).toHaveBeenCalled();
    expect(prismaMock.user.updateManyAndReturn).not.toHaveBeenCalled();
  });
});
