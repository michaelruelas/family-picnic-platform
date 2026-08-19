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
  potluckSignup: { deleteMany: vi.fn(), updateMany: vi.fn() },
  potluckSlot: { update: vi.fn() },
  rsvpMemberAttendance: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  householdMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  adminAuditLog: { create: vi.fn() },
  // FPP-48: syncRegistrationFee reads + upserts Registration rows
  // from inside the same transaction as the RSVP write.
  registration: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
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

/**
 * Default event mock that includes every field the route reads.
 * FPP-48 added the per-attendee fee config; tests that exercise the
 * fee sync path use these defaults so the mock always carries the
 * fee fields the route expects.
 */
function mockEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'e1',
    status: 'PUBLISHED',
    rsvpDeadline: null,
    maxCapacity: null,
    registrationFeeCents: 0,
    registrationFeeMinAge: 0,
    currency: 'usd',
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prismaMock);
  // FPP-48: syncRegistrationFee runs inside the same transaction as
  // the RSVP write. Default the registration mocks so the fee sync
  // treats every test as a fresh registration (creates one row, no
  // active charges to cancel).
  prismaMock.registration.findUnique.mockResolvedValue(null);
  prismaMock.registration.create.mockResolvedValue({
    id: 'reg-1',
    amountCents: 0,
    status: 'PENDING',
    currency: 'usd',
  } as never);
  prismaMock.registration.upsert.mockResolvedValue({
    id: 'reg-1',
    amountCents: 0,
    status: 'PENDING',
    currency: 'usd',
  } as never);
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
    prismaMock.event.findUnique.mockResolvedValue(mockEvent({ status: 'DRAFT' }) as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when RSVP deadline has passed', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent({ rsvpDeadline: new Date('2000-01-01') }) as never,
    );
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found in DB', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(mockEvent() as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(404);
  });

  it('confirms RSVP for valid input without max capacity', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(mockEvent() as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock) as never,
    );
    prismaMock.rSVP.upsert.mockResolvedValue({} as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', memberAttendances: [] } as never);
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
    prismaMock.event.findUnique.mockResolvedValue(mockEvent({ maxCapacity: 5 }) as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock) as never,
    );
    prismaMock.rSVP.aggregate
      .mockResolvedValueOnce({ _sum: { headcount: 5 }, _max: { waitlistPosition: 0 } })
      .mockResolvedValueOnce({ _sum: { headcount: 5 }, _max: { waitlistPosition: 0 } });
    prismaMock.rSVP.upsert.mockResolvedValue({} as never);
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', memberAttendances: [] } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'confirm' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('WAITLISTED');
    expect(body.waitlistPosition).toBe(1);
    // The route computes the response body from the computed waitlist position,
    // so a no-op transaction would still pass the assertions above. Assert the
    // upsert ran with the WAITLISTED status to prove persistence.
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.rSVP.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: 'WAITLISTED',
          waitlistPosition: 1,
        }),
      }),
    );
  });

  it('declines RSVP and runs decline flow with potluck release + waitlist promotion', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(mockEvent() as never);
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
    prismaMock.potluckSignup.updateMany.mockResolvedValue({} as never);
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);
    prismaMock.rSVP.findFirst.mockResolvedValue(null);

    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1', action: 'decline' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('DECLINED');
    // FPP-Postmortem: decline soft-deletes (set deletedAt) instead of
    // hard delete. The DB trigger blocks direct DELETE.
    expect(prismaMock.potluckSignup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(prismaMock.potluckSignup.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.potluckSlot.update).toHaveBeenCalled();
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalled();
  });

  it('promotes first waitlisted user when declining frees a confirmed slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(mockEvent() as never);
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

  it('rejects an all-NO memberAttendances list with 400', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      rsvpDeadline: null,
      maxCapacity: null,
    } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        action: 'confirm',
        memberAttendances: [{ householdMemberId: null, memberName: 'Pat', attending: 'NO' }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/At least one member must be marked as going/);
  });

  it('rejects a foreign householdMemberId with 400', async () => {
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
    prismaMock.householdMember.findMany.mockResolvedValue([]);
    prismaMock.rSVP.upsert.mockResolvedValue({ id: 'r-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        action: 'confirm',
        memberAttendances: [{ householdMemberId: 'foreign', memberName: 'Pat', attending: 'YES' }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not belong to this household/);
  });
});
