import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
  rSVP: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  rsvpMemberAttendance: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  householdMember: { findMany: vi.fn() },
  registration: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  charge: { updateMany: vi.fn() },
  eventAdmin: { findMany: vi.fn() },
  communicationLog: { createMany: vi.fn() },
  adminAuditLog: { create: vi.fn() },
  auditLog: { create: vi.fn() },
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
import { POST } from '~/app/api/admin/rsvp/override/route';

const mockedSession = vi.mocked(getServerSession);

const ADMIN_SESSION = { user: { id: 'admin-1', role: 'SUPER_ADMIN' } } as never;
// 'GUEST' is a sentinel value used only in tests to represent "not an admin" —
// it is not a real value in the Role enum. The isAdminRole mock returns false
// for any role string that is not in ADMIN_ROLES.
const NON_ADMIN_SESSION = { user: { id: 'u-1', role: 'GUEST' } } as never;

/**
 * Wires `prisma.$transaction` so it calls the callback with the
 * hoisted prisma mock itself. The route's `tx.rSVP.upsert(...)`
 * calls then resolve to the same vi.fn()s set up in each test,
 * so we can assert on them after the route returns.
 */
function wireTransaction() {
  prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(prismaMock),
  );
}

beforeEach(() => {
  resetPrismaMock(prismaMock);
  // Default to an event with no fee so the registration-sync path
  // is exercised but produces a $0 row.
  prismaMock.event.findUnique.mockResolvedValue({
    id: 'e1',
    status: 'PUBLISHED',
    registrationFeeCents: 0,
    registrationFeeMinAge: null,
    currency: 'usd',
  });
  prismaMock.user.findUnique.mockResolvedValue({ id: 'target-1', householdId: 'h-1' });
  prismaMock.rSVP.findUnique.mockResolvedValue(null);
  prismaMock.rSVP.upsert.mockResolvedValue({
    id: 'rsvp-1',
    eventId: 'e1',
    userId: 'target-1',
    status: 'CONFIRMED',
    headcount: 1,
  });
  prismaMock.householdMember.findMany.mockResolvedValue([
    { id: 'm1', name: 'Maria Garcia', age: 35, deletedAt: null },
  ]);
  // After the upsert, the route re-queries for the fee snapshot.
  prismaMock.rSVP.findUnique.mockResolvedValueOnce(null);
  prismaMock.rSVP.findUnique.mockResolvedValueOnce({ memberAttendances: [] });
  prismaMock.registration.findUnique.mockResolvedValue(null);
  prismaMock.registration.create.mockResolvedValue({ id: 'reg-1' });
  prismaMock.eventAdmin.findMany.mockResolvedValue([]);
  wireTransaction();
});

describe('POST /api/admin/rsvp/override', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue(NON_ADMIN_SESSION);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        userId: 'target-1',
        status: 'CONFIRMED',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with rsvpId/status/headcount on a valid CONFIRMED payload', async () => {
    mockedSession.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        userId: 'target-1',
        status: 'CONFIRMED',
        memberAttendances: [
          { householdMemberId: 'm1', memberName: 'Maria Garcia', memberAge: 35, attending: 'YES' },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rsvpId: string; status: string; headcount: number };
    expect(body.rsvpId).toBe('rsvp-1');
    expect(body.status).toBe('CONFIRMED');
    expect(body.headcount).toBe(1);

    // The route must have called the upsert with the resolved
    // (eventId, userId) pair and the YES-derived headcount.
    expect(prismaMock.rSVP.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'e1', userId: 'target-1' } },
        create: expect.objectContaining({ status: 'CONFIRMED', headcount: 1 }),
        update: expect.objectContaining({ status: 'CONFIRMED', headcount: 1 }),
      }),
    );
  });

  it('returns 404 when the target user is missing', async () => {
    mockedSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        userId: 'ghost',
        status: 'CONFIRMED',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('writes a DECLINE_NOTE CommunicationLog row to each event owner on decline', async () => {
    mockedSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.rSVP.upsert.mockReset();
    prismaMock.rSVP.upsert.mockResolvedValue({
      id: 'rsvp-1',
      eventId: 'e1',
      userId: 'target-1',
      status: 'DECLINED',
      headcount: 0,
    });
    // Re-stub findUnique for the post-upsert fee snapshot lookup
    // and the pre-upsert before-snapshot lookup. The route calls
    // findUnique twice in the transaction; we want both to
    // resolve to an empty attendance snapshot so the fee sync
    // is a no-op for the test.
    prismaMock.rSVP.findUnique.mockReset();
    prismaMock.rSVP.findUnique.mockResolvedValue({ memberAttendances: [] });
    prismaMock.eventAdmin.findMany.mockReset();
    prismaMock.eventAdmin.findMany.mockResolvedValue([
      { userId: 'owner-1' },
      { userId: 'owner-2' },
    ]);

    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        userId: 'target-1',
        status: 'DECLINED',
        declineMessage: '  Sorry, kid is sick  ',
      }),
    );
    expect(res.status).toBe(200);

    // The decline message is trimmed before forwarding.
    expect(prismaMock.communicationLog.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          eventId: 'e1',
          sentByUserId: 'admin-1',
          recipientUserId: 'owner-1',
          kind: 'DECLINE_NOTE',
          body: 'Sorry, kid is sick',
          status: 'QUEUED',
        }),
        expect.objectContaining({
          recipientUserId: 'owner-2',
          kind: 'DECLINE_NOTE',
          body: 'Sorry, kid is sick',
        }),
      ]),
    });
  });

  it('runs the registration-fee sync on confirm so paid events re-price', async () => {
    mockedSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.event.findUnique.mockReset();
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'PUBLISHED',
      registrationFeeCents: 2500,
      registrationFeeMinAge: 12,
      currency: 'usd',
    });
    prismaMock.rSVP.findUnique.mockReset();
    prismaMock.rSVP.findUnique.mockResolvedValueOnce(null); // before
    prismaMock.rSVP.findUnique.mockResolvedValueOnce({
      memberAttendances: [
        { attending: 'YES', memberAgeSnapshot: 35 },
        { attending: 'YES', memberAgeSnapshot: 8 },
      ],
    });
    prismaMock.registration.findUnique.mockResolvedValue(null);
    // The resolver looks up members by id and householdId to
    // confirm they belong to the target household. Return the
    // two members the test ships in `memberAttendances`.
    prismaMock.householdMember.findMany.mockReset();
    prismaMock.householdMember.findMany.mockResolvedValue([
      { id: 'a', name: 'Adult', age: 35, deletedAt: null },
      { id: 'k', name: 'Kid', age: 8, deletedAt: null },
    ]);

    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        userId: 'target-1',
        status: 'CONFIRMED',
        memberAttendances: [
          { householdMemberId: 'a', memberName: 'Adult', memberAge: 35, attending: 'YES' },
          { householdMemberId: 'k', memberName: 'Kid', memberAge: 8, attending: 'YES' },
        ],
      }),
    );
    expect(res.status).toBe(200);

    // A new Registration row must have been created with the
    // fee derived from the event + attendance snapshot. The
    // exact cents depend on the calculator — we just assert
    // the row is written.
    expect(prismaMock.registration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'e1',
          userId: 'target-1',
          householdId: 'h-1',
          currency: 'usd',
          status: 'PENDING',
        }),
      }),
    );
  });
});
