import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { update: vi.fn(), findUnique: vi.fn() },
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
import { GET, PATCH } from '~/app/api/profile/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  user: { update: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
};

function makeReq(url: string, body?: unknown, method = 'PATCH'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [p.user.update, p.user.findUnique]) {
    fn.mockReset();
  }
});

describe('GET /api/profile', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('returns user profile with household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockResolvedValue({
      id: 'u-1',
      name: 'Alice',
      email: 'a@example.com',
      communicationPreference: 'EMAIL',
      household: { id: 'h-1', name: 'The Smiths' },
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('u-1');
    expect(body.household.id).toBe('h-1');
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/profile', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await PATCH(makeReq('http://x', { name: 'New' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid name (empty)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await PATCH(makeReq('http://x', { name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid communication preference', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await PATCH(makeReq('http://x', { communicationPreference: 'INVALID' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when no valid fields provided', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await PATCH(makeReq('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('updates the name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.update.mockResolvedValue({
      id: 'u-1',
      name: 'New',
      email: 'a@example.com',
      communicationPreference: 'EMAIL',
      household: { id: 'h-1', name: 'The Smiths' },
    } as never);
    const res = await PATCH(makeReq('http://x', { name: 'New' }));
    expect(res.status).toBe(200);
    expect(p.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'New' }) }),
    );
  });

  it('updates the communication preference', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.update.mockResolvedValue({
      id: 'u-1',
      name: 'Alice',
      email: 'a@example.com',
      communicationPreference: 'SMS',
      household: { id: 'h-1', name: 'The Smiths' },
    } as never);
    const res = await PATCH(makeReq('http://x', { communicationPreference: 'SMS' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.user.update.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makeReq('http://x', { name: 'New' }));
    expect(res.status).toBe(500);
  });
});
