import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  photo: { findUnique: vi.fn() },
  photoReaction: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
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
import { POST } from '~/app/api/photo-reaction/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/photo-reaction', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid reaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1', reaction: '🌮' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing photoId', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { photoId: '', reaction: '❤️' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when photo not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(404);
  });

  it('adds a new reaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockResolvedValue({ id: 'p1' } as never);
    prismaMock.photoReaction.findUnique.mockResolvedValue(null);
    prismaMock.photoReaction.create.mockResolvedValue({} as never);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('added');
  });

  it('removes an existing reaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockResolvedValue({ id: 'p1' } as never);
    prismaMock.photoReaction.findUnique.mockResolvedValue({ id: 'pr-1' } as never);
    prismaMock.photoReaction.delete.mockResolvedValue({} as never);
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('removed');
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', { photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(500);
  });
});
