import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  photo: { create: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
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
import { POST, GET } from '~/app/api/photos/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  photo: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  event: { findUnique: ReturnType<typeof vi.fn> };
};

function makeReq(url: string, body?: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [p.photo.create, p.photo.findMany, p.user.findUnique, p.event.findUnique]) {
    fn.mockReset();
  }
});

describe('POST /api/photos', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeReq('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq('http://x', { eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when user has no household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: null } as never);
    const res = await POST(makeReq('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }));
    expect(res.status).toBe(404);
  });

  it('creates a photo', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    p.photo.create.mockResolvedValue({ id: 'photo-1' } as never);
    const res = await POST(
      makeReq('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u', caption: 'Fun' }),
    );
    expect(res.status).toBe(200);
    expect(p.photo.create).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeReq('http://x', { eventId: 'e1', photoPrismId: 'pp1', url: 'u' }));
    expect(res.status).toBe(500);
  });
});

describe('GET /api/photos', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET(makeReq('http://x', undefined, 'GET'));
    expect(res.status).toBe(401);
  });

  it('returns photos for an event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findMany.mockResolvedValue([{ id: 'photo-1' }] as never);
    const res = await GET(makeReq('http://x?eventId=e1', undefined, 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findMany.mockRejectedValue(new Error('boom'));
    const res = await GET(makeReq('http://x?eventId=e1', undefined, 'GET'));
    expect(res.status).toBe(500);
  });
});
