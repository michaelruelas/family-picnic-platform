import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  potluckSlot: { findUnique: vi.fn(), update: vi.fn() },
  potluckSignup: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  rSVP: { findUnique: vi.fn() },
  $transaction: vi.fn(),
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
import { POST } from '~/app/api/potluck-signup/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  potluckSlot: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  potluckSignup: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
  rSVP: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/potluck-signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.potluckSlot.findUnique,
    p.potluckSlot.update,
    p.potluckSignup.findUnique,
    p.potluckSignup.create,
    p.potluckSignup.update,
    p.potluckSignup.count,
    p.potluckSignup.delete,
    p.user.findUnique,
    p.rSVP.findUnique,
    p.$transaction,
  ]) {
    fn.mockReset();
  }
});

describe('POST /api/potluck-signup', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when slotId is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ slotId: 's1', dishName: 'Salad' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action value', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ slotId: 's1', action: 'frobnicate' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid signup (no dishName)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ slotId: 's1', action: 'signup' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when slot not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is not published', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'DRAFT' },
    } as never);
    const res = await POST(makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when user has no confirmed RSVP', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when rsvp exists but status is not CONFIRMED', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'DECLINED' } as never);
    const res = await POST(makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(400);
  });

  it('creates a new signup for an OPEN slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    p.potluckSignup.findUnique.mockResolvedValue(null);
    p.potluckSignup.create.mockResolvedValue({ id: 'ps-1' } as never);
    const res = await POST(
      makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad', servings: 2 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.action).toBe('created');
    expect(p.potluckSignup.create).toHaveBeenCalled();
  });

  it('updates an existing signup', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    p.potluckSignup.findUnique.mockResolvedValue({ id: 'ps-1' } as never);
    p.potluckSignup.update.mockResolvedValue({} as never);
    const res = await POST(
      makeReq({ slotId: 's1', action: 'signup', dishName: 'Updated', servings: 4 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('updated');
  });

  it('creates signup for a LIMITED slot with room', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'LIMITED',
      maxSignups: 5,
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    p.potluckSignup.findUnique.mockResolvedValue(null);
    p.$transaction.mockImplementation(
      async (fn: (tx: typeof p) => unknown) =>
        fn({
          ...p,
          potluckSignup: {
            ...p.potluckSignup,
            count: vi.fn().mockResolvedValue(2),
            create: vi.fn().mockResolvedValue({}),
          },
          potluckSlot: { ...p.potluckSlot, update: vi.fn().mockResolvedValue({}) },
        } as never) as never,
    );
    const res = await POST(
      makeReq({ slotId: 's1', action: 'signup', dishName: 'Cake', servings: 1 }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 409 when LIMITED slot is full inside the transaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'LIMITED',
      maxSignups: 5,
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    p.potluckSignup.findUnique.mockResolvedValue(null);
    p.$transaction.mockImplementation(async (fn: (tx: typeof p) => unknown) => {
      const tx = {
        potluckSignup: { ...p.potluckSignup, count: vi.fn().mockResolvedValue(5) },
        potluckSlot: p.potluckSlot,
      };
      return fn(tx as typeof p) as never;
    });
    const res = await POST(
      makeReq({ slotId: 's1', action: 'signup', dishName: 'Cake', servings: 1 }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CONFLICT');
  });

  it('returns 404 when cancelling a non-existent signup', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    p.potluckSignup.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ slotId: 's1', action: 'cancel' }));
    expect(res.status).toBe(404);
  });

  it('cancels a signup and decrements currentSignups', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    p.potluckSignup.findUnique.mockResolvedValue({ id: 'ps-1' } as never);
    p.potluckSignup.delete.mockResolvedValue({} as never);
    p.potluckSlot.update.mockResolvedValue({} as never);
    const res = await POST(makeReq({ slotId: 's1', action: 'cancel' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('cancelled');
  });

  it('returns 500 on unexpected error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.potluckSlot.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeReq({ slotId: 's1', action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(500);
  });
});
