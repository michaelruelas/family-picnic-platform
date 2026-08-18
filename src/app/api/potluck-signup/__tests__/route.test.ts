import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

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

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/potluck-signup/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/potluck-signup', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { slotId: 's1', action: 'signup', dishName: 'Salad' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when slotId is missing on signup', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { action: 'signup', dishName: 'Salad' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when signupId is missing on cancel', async () => {
    // Multi-claim: cancel targets a single signup row by `id`, not
    // by `slotId`. The legacy `slotId`-keyed cancel is gone.
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { action: 'cancel', slotId: 's1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { slotId: 's1', dishName: 'Salad' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action value', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { slotId: 's1', action: 'frobnicate' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid signup (no dishName)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { slotId: 's1', action: 'signup' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when slot not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { slotId: 's1', action: 'signup', dishName: 'Salad' }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is not published', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'DRAFT' },
    } as never);
    const res = await POST(
      makeJsonRequest('http://x', { slotId: 's1', action: 'signup', dishName: 'Salad' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { slotId: 's1', action: 'signup', dishName: 'Salad' }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when user has no confirmed RSVP', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    prismaMock.rSVP.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { slotId: 's1', action: 'signup', dishName: 'Salad' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when rsvp exists but status is not CONFIRMED', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'DECLINED' } as never);
    const res = await POST(
      makeJsonRequest('http://x', { slotId: 's1', action: 'signup', dishName: 'Salad' }),
    );
    expect(res.status).toBe(400);
  });

  it('creates a new signup for an OPEN slot (multi-claim: no upsert)', async () => {
    // Multi-claim: signup is unconditional create. Even when the
    // caller already has a row on the slot, the call produces a new
    // row keyed by its own cuid.
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'OPEN',
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    prismaMock.potluckSignup.create.mockResolvedValue({ id: 'ps-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        slotId: 's1',
        action: 'signup',
        dishName: 'Salad',
        servings: 2,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.action).toBe('created');
    expect(prismaMock.potluckSignup.create).toHaveBeenCalled();
  });

  it('creates signup for a LIMITED slot with room', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'LIMITED',
      maxSignups: 5,
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) =>
        fn({
          ...prismaMock,
          potluckSignup: {
            ...prismaMock.potluckSignup,
            count: vi.fn().mockResolvedValue(2),
            create: vi.fn().mockResolvedValue({}),
          },
          potluckSlot: { ...prismaMock.potluckSlot, update: vi.fn().mockResolvedValue({}) },
        } as never) as never,
    );
    const res = await POST(
      makeJsonRequest('http://x', {
        slotId: 's1',
        action: 'signup',
        dishName: 'Cake',
        servings: 1,
      }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 409 when LIMITED slot is full inside the transaction', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's1',
      slotType: 'LIMITED',
      maxSignups: 5,
      eventId: 'e1',
      event: { id: 'e1', status: 'PUBLISHED' },
    } as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1', status: 'CONFIRMED' } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      const tx = {
        potluckSignup: { ...prismaMock.potluckSignup, count: vi.fn().mockResolvedValue(5) },
        potluckSlot: prismaMock.potluckSlot,
      };
      return fn(tx as typeof prismaMock) as never;
    });
    const res = await POST(
      makeJsonRequest('http://x', {
        slotId: 's1',
        action: 'signup',
        dishName: 'Cake',
        servings: 1,
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CONFLICT');
  });

  it('returns 404 when cancelling a non-existent signup', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.potluckSignup.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { action: 'cancel', signupId: 'ps-x' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when caller does not own the signup being cancelled', async () => {
    // Multi-claim: cancel is keyed by signupId but ownership is
    // checked server-side via the signup → slot → RSVP walk.
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1' } as never);
    prismaMock.potluckSignup.findUnique.mockResolvedValue({
      id: 'ps-1',
      rsvpId: 'other-rsvp',
      slot: { id: 's1', eventId: 'e1' },
    } as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1' } as never);
    const res = await POST(makeJsonRequest('http://x', { action: 'cancel', signupId: 'ps-1' }));
    expect(res.status).toBe(404);
  });

  it('cancels a signup by signupId and decrements currentSignups', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1' } as never);
    prismaMock.potluckSignup.findUnique.mockResolvedValue({
      id: 'ps-1',
      rsvpId: 'r-1',
      slot: { id: 's1', eventId: 'e1' },
    } as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1' } as never);
    prismaMock.potluckSignup.delete.mockResolvedValue({} as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await POST(makeJsonRequest('http://x', { action: 'cancel', signupId: 'ps-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('cancelled');
  });

  it('returns 500 on unexpected error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(
      makeJsonRequest('http://x', { slotId: 's1', action: 'signup', dishName: 'Salad' }),
    );
    expect(res.status).toBe(500);
  });
});
