import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

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

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/rsvp/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/rsvp', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when eventId is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action value', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'frob' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid confirm payload (negative headcount)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm', headcount: -1 }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid decline payload (empty eventId)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: '', action: 'decline' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is not published', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'DRAFT',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when RSVP deadline has passed', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: new Date('2000-01-01'),
      maxCapacity: null,
    } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found in DB', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(404);
  });

  it('confirms RSVP for valid input without max capacity', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.rSVP.upsert.mockResolvedValue({} as never);
    const res = await POST(
      makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm', headcount: 2 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('CONFIRMED');
    expect(prismaMock.rSVP.upsert).toHaveBeenCalled();
  });

  it('waitlists when max capacity is reached', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: 5,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.rSVP.aggregate
      .mockResolvedValueOnce({ _sum: { headcount: 5 }, _max: { waitlistPosition: 0 } })
      .mockResolvedValueOnce({ _sum: { headcount: 5 }, _max: { waitlistPosition: 0 } });
    prismaMock.rSVP.upsert.mockResolvedValue({} as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('WAITLISTED');
    expect(body.waitlistPosition).toBe(1);
  });

  it('declines RSVP and runs decline flow with potluck release + waitlist promotion', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock) as never,
    );
    prismaMock.rSVP.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'CONFIRMED',
      headcount: 2,
      potluckSignups: [
        { slotId: 's-1', servings: 3, slot: { id: 's-1' } },
        { slotId: 's-2', servings: 1, slot: { id: 's-2' } },
      ],
    } as never);
    prismaMock.rSVP.upsert.mockResolvedValue({} as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    prismaMock.potluckSignup.deleteMany.mockResolvedValue({} as never);
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);
    prismaMock.rSVP.findFirst.mockResolvedValue(null);

    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'decline' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('DECLINED');
    expect(prismaMock.potluckSignup.deleteMany).toHaveBeenCalled();
    expect(prismaMock.potluckSlot.update).toHaveBeenCalled();
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalled();
  });

  it('promotes first waitlisted user when declining frees a confirmed slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock) as never,
    );
    prismaMock.rSVP.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'CONFIRMED',
      headcount: 1,
      potluckSignups: [],
    } as never);
    prismaMock.rSVP.upsert.mockResolvedValue({} as never);
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);
    prismaMock.rSVP.findFirst.mockResolvedValue({
      id: 'r-2',
      userId: 'u-2',
      waitlistPosition: 1,
    } as never);
    prismaMock.rSVP.update.mockResolvedValue({} as never);
    prismaMock.rSVP.updateMany.mockResolvedValue({} as never);

    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'decline' }));
    expect(res.status).toBe(200);
    expect(prismaMock.rSVP.update).toHaveBeenCalled();
    expect(prismaMock.rSVP.updateMany).toHaveBeenCalled();
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
