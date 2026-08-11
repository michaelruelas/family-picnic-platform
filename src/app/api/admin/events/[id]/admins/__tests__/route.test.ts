import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  eventAdmin: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(() => Promise.resolve(0)),
  },
  // FPP-65: stampHostRole calls user.updateManyAndReturn (not
  // updateMany) so the helper can report which rows were promoted.
  // updateMany is kept for any other future caller; default it to a
  // harmless payload so `prismaMock.user.updateMany` mocks reset
  // cleanly even if no test asserts on them.
  user: {
    findMany: vi.fn(),
    updateMany: vi.fn(() => ({ count: 0 })),
    updateManyAndReturn: vi.fn(() => []),
  },
  $transaction: vi.fn(),
  auditLog: { create: vi.fn() },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

vi.mock('~/lib/logger', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  generateRequestId: () => 'req-test',
}));

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { POST } from '~/app/api/admin/events/[id]/admins/route';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

// FPP-65: the new route wraps writes in `$transaction` for atomic
// role-stamp + EventAdmin create. The mocks replicate that contract.
function mockTransaction() {
  prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
    if (typeof ops === 'function') {
      return (ops as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    return Promise.all(ops as Promise<unknown>[]);
  });
}

function makeAssignedRow(userId: string) {
  return {
    id: `ea-${userId}`,
    userId,
    user: { id: userId, name: 'User', email: `${userId}@x.com`, household: null },
  };
}

beforeEach(() => {
  resetPrismaMock(prismaMock);
  mockTransaction();
});

describe('POST /api/admin/events/[id]/admins', () => {
  it('returns 403 when caller has no admin role or EventAdmin row', async () => {
    // FPP-65 audit: GUEST has a session but no admin role and no
    // EventAdmin row — `requireEventAdminApi` returns 403, not 401.
    // 401 is reserved for missing sessions.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(403);
  });

  it('returns 401 when no session at all', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when userId/userIds missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on unknown role value', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2', role: 'NOT_A_ROLE' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 with skipped set when every target is already assigned', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    prismaMock.eventAdmin.findMany.mockResolvedValue([{ userId: 'u-2' }] as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assigned).toEqual([]);
    expect(body.skipped).toContain('u-2');
    expect(prismaMock.eventAdmin.create).not.toHaveBeenCalled();
  });

  it('adds a new admin with explicit role', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    prismaMock.eventAdmin.findMany.mockResolvedValue([]);
    prismaMock.eventAdmin.create.mockResolvedValue(makeAssignedRow('u-2') as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2', role: 'COADMIN' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
    // COADMIN is not a host — stampHostRole should NOT have run.
    expect(prismaMock.user.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('defaults to OWNER when role omitted (FPP-65 host assignment)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    prismaMock.eventAdmin.findMany.mockResolvedValue([]);
    prismaMock.eventAdmin.create.mockResolvedValue(makeAssignedRow('u-2') as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
    expect(prismaMock.eventAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER' }) }),
    );
  });

  it('stamps User.role = HOST when assigning an OWNER to a non-super-admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    prismaMock.eventAdmin.findMany.mockResolvedValue([]);
    prismaMock.eventAdmin.create.mockResolvedValue(makeAssignedRow('u-2') as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2', role: 'OWNER' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
    expect(prismaMock.user.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['u-2'] },
          role: { not: 'SUPER_ADMIN' },
        }),
        data: { role: 'HOST' },
      }),
    );
  });

  it('does NOT stamp User.role = HOST for COADMIN or INVITER assignments', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    prismaMock.eventAdmin.findMany.mockResolvedValue([]);
    prismaMock.eventAdmin.create.mockResolvedValue(makeAssignedRow('u-2') as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2', role: 'COADMIN' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
    expect(prismaMock.user.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects HOST self-assignment (FPP-65 audit)', async () => {
    // A HOST who can already access the event (validated by
    // requireEventAdminApi) tries to also list themselves as a
    // host. The defensive self-assignment guard rejects with 403.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'HOST' } } as never);
    // The requireEventAdminApi gate consults canAccessEvent — make
    // sure the mock returns a row so HOST passes the gate.
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-existing' } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-1' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(403);
    expect(prismaMock.eventAdmin.create).not.toHaveBeenCalled();
  });

  it('rejects ADMIN_ADULT self-assignment (FPP-104 followup)', async () => {
    // FPP-104: the previous self-assignment guard used `isAdminRole`,
    // which let a default `ADMIN_ADULT` user (who has no special
    // platform-level privilege) self-promote to OWNER on an event
    // they already had a row for. The check now uses
    // `isSuperAdminRole`, so an `ADMIN_ADULT` self-assignment is
    // also rejected with 403.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN_ADULT' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-existing' } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-1' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(403);
    expect(prismaMock.eventAdmin.create).not.toHaveBeenCalled();
  });

  it('allows super-admin self-assignment (FPP-65 audit)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    prismaMock.eventAdmin.findMany.mockResolvedValue([]);
    prismaMock.eventAdmin.create.mockResolvedValue(makeAssignedRow('u-1') as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-1' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
  });

  it('bulk-assigns multiple users via userIds[]', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', name: 'Picnic' } as never);
    prismaMock.eventAdmin.findMany.mockResolvedValue([{ userId: 'u-3' }] as never);
    prismaMock.eventAdmin.create
      .mockResolvedValueOnce(makeAssignedRow('u-2') as never)
      .mockResolvedValueOnce(makeAssignedRow('u-4') as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userIds: ['u-2', 'u-3', 'u-4'], role: 'OWNER' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assigned).toHaveLength(2);
    expect(body.skipped).toEqual(['u-3']);
  });
});
