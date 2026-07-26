import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  photo: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  adminAuditLog: { create: vi.fn() },
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
import { POST } from '~/app/api/photo-delete/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  photo: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  adminAuditLog: { create: ReturnType<typeof vi.fn> };
};

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/photo-delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.photo.findUnique,
    p.photo.update,
    p.user.findUnique,
    p.adminAuditLog.create,
  ]) {
    fn.mockReset();
  }
});

describe('POST /api/photo-delete', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeReq({ photoId: 'p1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when photoId missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when photo not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ photoId: 'p1' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not uploader and not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockResolvedValue({
      id: 'p1',
      uploadedByUserId: 'u-other',
      eventId: 'e1',
    } as never);
    p.user.findUnique.mockResolvedValue({ role: 'ADMIN_ADULT' } as never);
    const res = await POST(makeReq({ photoId: 'p1' }));
    expect(res.status).toBe(403);
  });

  it('soft-deletes a photo when user is uploader', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockResolvedValue({
      id: 'p1',
      uploadedByUserId: 'u-1',
      eventId: 'e1',
    } as never);
    p.user.findUnique.mockResolvedValue({ role: 'ADMIN_ADULT' } as never);
    p.photo.update.mockResolvedValue({} as never);
    p.adminAuditLog.create.mockResolvedValue({} as never);
    const res = await POST(makeReq({ photoId: 'p1' }));
    expect(res.status).toBe(200);
    expect(p.photo.update).toHaveBeenCalled();
    expect(p.adminAuditLog.create).toHaveBeenCalled();
  });

  it('soft-deletes a photo when user is admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockResolvedValue({
      id: 'p1',
      uploadedByUserId: 'u-other',
      eventId: 'e1',
    } as never);
    p.user.findUnique.mockResolvedValue({ role: 'ADMIN' } as never);
    p.photo.update.mockResolvedValue({} as never);
    p.adminAuditLog.create.mockResolvedValue({} as never);
    const res = await POST(makeReq({ photoId: 'p1' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeReq({ photoId: 'p1' }));
    expect(res.status).toBe(500);
  });
});
