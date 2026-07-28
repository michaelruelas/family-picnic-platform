import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  photo: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  adminAuditLog: { create: vi.fn() },
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
import { POST } from '~/app/api/photo-delete/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/photo-delete', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when photoId missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when photo not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not uploader and not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockResolvedValue({
      id: 'p1',
      uploadedByUserId: 'u-other',
      eventId: 'e1',
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ role: 'GUEST' } as never);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1' }));
    expect(res.status).toBe(403);
  });

  it('soft-deletes a photo when user is uploader', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockResolvedValue({
      id: 'p1',
      uploadedByUserId: 'u-1',
      eventId: 'e1',
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN_ADULT' } as never);
    prismaMock.photo.update.mockResolvedValue({} as never);
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1' }));
    expect(res.status).toBe(200);
    expect(prismaMock.photo.update).toHaveBeenCalled();
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalled();
  });

  it('soft-deletes a photo when user is admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockResolvedValue({
      id: 'p1',
      uploadedByUserId: 'u-other',
      eventId: 'e1',
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' } as never);
    prismaMock.photo.update.mockResolvedValue({} as never);
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1' }));
    expect(res.status).toBe(500);
  });
});
