import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn() },
  // FPP-104: the per-event gate consults canAccessEvent.
  eventAdmin: { findUnique: vi.fn(() => Promise.resolve(null)) },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

// FPP-70 / QUB-26.1: re-open must write an audit entry. Stub
// writeAuditLog so the test can assert the exact payload without a
// real AdminAuditLog row.
const mockWriteAuditLog = vi.fn();
vi.mock('~/lib/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/admin/events/[id]/reopen/route';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
  mockWriteAuditLog.mockClear();
});

describe('POST /api/admin/events/[id]/reopen', () => {
  it('returns 401 when no session at all', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(403);
  });

  it('FPP-104: allows a HOST with an EventAdmin row to re-open the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'CLOSED' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(404);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('returns 400 when event is already open (PUBLISHED)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(400);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('returns 400 when event is not CLOSED (archived/draft/cancelled)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    for (const status of ['DRAFT', 'CANCELLED', 'ARCHIVED']) {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', status } as never);
      const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
      expect(res.status).toBe(400);
    }
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('re-opens a CLOSED event to PUBLISHED and writes an audit entry (QUB-26.1)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', status: 'CLOSED' } as never);
    prismaMock.event.update.mockResolvedValue({ id: 'e-1', status: 'PUBLISHED' } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);

    expect(prismaMock.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e-1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      userId: 'u-1',
      eventId: 'e-1',
      action: 'event.reopen',
      oldValue: { status: 'CLOSED' },
      newValue: { status: 'PUBLISHED' },
    });
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(500);
  });
});
