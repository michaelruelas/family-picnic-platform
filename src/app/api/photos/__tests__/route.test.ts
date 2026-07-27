import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  photo: { create: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
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
import { POST, GET } from '~/app/api/photos/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/photos', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when user has no household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: null } as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }),
    );
    expect(res.status).toBe(404);
  });

  it('creates a photo', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.photo.create.mockResolvedValue({ id: 'photo-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u', caption: 'Fun' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.photo.create).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }),
    );
    expect(res.status).toBe(500);
  });
});

describe('GET /api/photos', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET(makeJsonRequest('http://x', undefined, 'GET'));
    expect(res.status).toBe(401);
  });

  it('returns photos for an event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findMany.mockResolvedValue([{ id: 'photo-1' }] as never);
    const res = await GET(makeJsonRequest('http://x?eventId=e1', undefined, 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.photo.findMany.mockRejectedValue(new Error('boom'));
    const res = await GET(makeJsonRequest('http://x?eventId=e1', undefined, 'GET'));
    expect(res.status).toBe(500);
  });
});
