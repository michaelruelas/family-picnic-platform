import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  photo: { findUnique: vi.fn() },
  photoReaction: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) },
      }),
  },
}));

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/photo-reaction/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  photo: { findUnique: ReturnType<typeof vi.fn> };
  photoReaction: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/photo-reaction', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [p.photo.findUnique, p.photoReaction.findUnique, p.photoReaction.create, p.photoReaction.delete]) {
    fn.mockReset();
  }
});

describe('POST /api/photo-reaction', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeReq({ photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid reaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ photoId: 'p1', reaction: '🌮' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing photoId', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ photoId: '', reaction: '❤️' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when photo not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(404);
  });

  it('adds a new reaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockResolvedValue({ id: 'p1' } as never);
    p.photoReaction.findUnique.mockResolvedValue(null);
    p.photoReaction.create.mockResolvedValue({} as never);
    const res = await POST(makeReq({ photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('added');
  });

  it('removes an existing reaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockResolvedValue({ id: 'p1' } as never);
    p.photoReaction.findUnique.mockResolvedValue({ id: 'pr-1' } as never);
    p.photoReaction.delete.mockResolvedValue({} as never);
    const res = await POST(makeReq({ photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('removed');
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.photo.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeReq({ photoId: 'p1', reaction: '❤️' }));
    expect(res.status).toBe(500);
  });
});
