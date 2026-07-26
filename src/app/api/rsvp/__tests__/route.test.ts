import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
  getToken: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  rSVP: {
    aggregate: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  potluckSignup: { deleteMany: vi.fn() },
  potluckSlot: { update: vi.fn() },
  adminAuditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('~/lib/ow-client', () => ({
  getOpenWorkflow: vi.fn().mockResolvedValue({ runWorkflow: vi.fn() }),
}));

vi.mock('~/lib/ow-workflows', () => ({
  rsvpConfirm: { spec: { name: 'rsvp-confirm' } },
  rsvpDecline: { spec: { name: 'rsvp-decline' } },
}));

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
import { POST } from '~/app/api/rsvp/route';

const mockedSession = vi.mocked(getServerSession);
const p = prismaMock as unknown as {
  event: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  rSVP: {
    aggregate: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  potluckSignup: { deleteMany: ReturnType<typeof vi.fn> };
  potluckSlot: { update: ReturnType<typeof vi.fn> };
  adminAuditLog: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/rsvp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  for (const fn of [
    p.event.findUnique,
    p.user.findUnique,
    p.rSVP.aggregate,
    p.rSVP.upsert,
    p.rSVP.findUnique,
    p.rSVP.findFirst,
    p.rSVP.update,
    p.rSVP.updateMany,
    p.potluckSignup.deleteMany,
    p.potluckSlot.update,
    p.adminAuditLog.create,
    p.$transaction,
  ]) {
    fn.mockReset();
  }
});

describe('POST /api/rsvp', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when eventId is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action value', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ eventId: 'e1', action: 'frob' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid confirm payload (negative headcount)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm', headcount: -1 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid decline payload (empty eventId)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeReq({ eventId: '', action: 'decline' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is not published', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'DRAFT',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when RSVP deadline has passed', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: new Date('2000-01-01'),
      maxCapacity: null,
    } as never);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found in DB', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    p.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(404);
  });

  it('confirms RSVP for valid input without max capacity', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.upsert.mockResolvedValue({} as never);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm', headcount: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('CONFIRMED');
    expect(p.rSVP.upsert).toHaveBeenCalled();
  });

  it('waitlists when max capacity is reached', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: 5,
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.rSVP.aggregate
      .mockResolvedValueOnce({ _sum: { headcount: 5 }, _max: { waitlistPosition: 0 } })
      .mockResolvedValueOnce({ _sum: { headcount: 5 }, _max: { waitlistPosition: 0 } });
    p.rSVP.upsert.mockResolvedValue({} as never);
    const res = await POST(makeReq({ eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('WAITLISTED');
    expect(body.waitlistPosition).toBe(1);
  });

  it('declines RSVP and runs decline flow with potluck release + waitlist promotion', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.$transaction.mockImplementation(async (fn: (tx: typeof p) => unknown) => fn(p) as never);
    p.rSVP.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'CONFIRMED',
      headcount: 2,
      potluckSignups: [
        { slotId: 's-1', servings: 3, slot: { id: 's-1' } },
        { slotId: 's-2', servings: 1, slot: { id: 's-2' } },
      ],
    } as never);
    p.rSVP.upsert.mockResolvedValue({} as never);
    p.potluckSlot.update.mockResolvedValue({} as never);
    p.potluckSignup.deleteMany.mockResolvedValue({} as never);
    p.adminAuditLog.create.mockResolvedValue({} as never);
    p.rSVP.findFirst.mockResolvedValue(null);

    const res = await POST(makeReq({ eventId: 'e1', action: 'decline' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('DECLINED');
    expect(p.potluckSignup.deleteMany).toHaveBeenCalled();
    expect(p.potluckSlot.update).toHaveBeenCalled();
    expect(p.adminAuditLog.create).toHaveBeenCalled();
  });

  it('promotes first waitlisted user when declining frees a confirmed slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    p.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    p.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    p.$transaction.mockImplementation(async (fn: (tx: typeof p) => unknown) => fn(p) as never);
    p.rSVP.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'CONFIRMED',
      headcount: 1,
      potluckSignups: [],
    } as never);
    p.rSVP.upsert.mockResolvedValue({} as never);
    p.adminAuditLog.create.mockResolvedValue({} as never);
    p.rSVP.findFirst.mockResolvedValue({
      id: 'r-2',
      userId: 'u-2',
      waitlistPosition: 1,
    } as never);
    p.rSVP.update.mockResolvedValue({} as never);
    p.rSVP.updateMany.mockResolvedValue({} as never);

    const res = await POST(makeReq({ eventId: 'e1', action: 'decline' }));
    expect(res.status).toBe(200);
    expect(p.rSVP.update).toHaveBeenCalled();
    expect(p.rSVP.updateMany).toHaveBeenCalled();
  });

  it('returns 500 when request body is invalid JSON', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const badReq = new Request('http://localhost/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(badReq);
    expect(res.status).toBe(500);
  });
});
