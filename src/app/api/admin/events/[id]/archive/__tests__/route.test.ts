import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn() },
  // FPP-104: per-event gate consults canAccessEvent via the EventAdmin table.
  eventAdmin: { findUnique: vi.fn(() => Promise.resolve(null)) },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

// FPP-68 / QUB-12 / QUB-26.1: archive writes an audit entry.
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
import { POST } from '~/app/api/admin/events/[id]/archive/route';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
  mockWriteAuditLog.mockClear();
});

describe('POST /api/admin/events/[id]/archive', () => {
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

  it('FPP-104: allows a HOST with an EventAdmin row to archive the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', archivedAt: null } as never);
    prismaMock.event.update.mockResolvedValue({
      id: 'e-1',
      archivedAt: new Date('2026-08-12T00:00:00Z'),
    } as never);
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

  it('archives an event and writes the audit entry (QUB-26.1)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const archiveTimestamp = new Date('2026-08-12T12:00:00Z');
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1', archivedAt: null } as never);
    prismaMock.event.update.mockResolvedValue({
      id: 'e-1',
      archivedAt: archiveTimestamp,
    } as never);

    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);

    expect(prismaMock.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e-1' },
        data: expect.objectContaining({ archivedAt: expect.any(Date) }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      userId: 'u-1',
      eventId: 'e-1',
      action: 'event.archive',
      oldValue: { archivedAt: null },
      newValue: { archivedAt: archiveTimestamp },
    });
  });

  it('is idempotent — re-archiving does not write a new audit entry or rewrite the timestamp', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const existingTimestamp = new Date('2026-01-01T00:00:00Z');
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e-1',
      archivedAt: existingTimestamp,
    } as never);

    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);
    expect(prismaMock.event.update).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(500);
  });
});
