import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  rSVP: { findUnique: vi.fn() },
  potluckSignup: { findMany: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

const { potluckRouter } = await import('~/server/routers/potluck.router');
const { createCallerFactory } = await import('~/lib/trpc');

const createCaller = createCallerFactory(potluckRouter);

const userSession = {
  user: {
    id: 'u-1',
    email: 'u@example.com',
    name: 'U',
    role: 'ADMIN' as const,
    householdId: null,
  },
  expires: '2099-01-01',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('potluck.getMySignups', () => {
  it('requires a session', async () => {
    const caller = createCaller({ session: null });
    await expect(caller.getMySignups({ eventId: 'e-1' })).rejects.toThrow();
  });

  it('returns an empty array when the caller has no RSVP for the event', async () => {
    prismaMock.rSVP.findUnique.mockResolvedValue(null);
    const caller = createCaller({ session: userSession });
    const result = await caller.getMySignups({ eventId: 'e-1' });
    expect(result).toEqual([]);
    expect(prismaMock.potluckSignup.findMany).not.toHaveBeenCalled();
  });

  it('returns the caller signups ordered by claimedAt', async () => {
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1' });
    prismaMock.potluckSignup.findMany.mockResolvedValue([
      {
        id: 'ps-1',
        slotId: 's-1',
        dishName: 'Mac and cheese',
        servings: 1,
        dietaryLabels: [],
        claimedAt: new Date('2026-08-01T10:00:00Z'),
        slot: { id: 's-1', name: 'Side 1', category: 'SIDE', slotType: 'LIMITED' },
      },
      {
        id: 'ps-2',
        slotId: 's-2',
        dishName: 'Brownies',
        servings: 2,
        dietaryLabels: ['vegetarian'],
        claimedAt: new Date('2026-08-01T11:00:00Z'),
        slot: { id: 's-2', name: 'Dessert 1', category: 'DESSERT', slotType: 'UNLIMITED' },
      },
    ]);
    const caller = createCaller({ session: userSession });
    const result = await caller.getMySignups({ eventId: 'e-1' });
    expect(result).toHaveLength(2);
    expect(result[0]?.dishName).toBe('Mac and cheese');
    expect(result[1]?.dishName).toBe('Brownies');
    expect(prismaMock.potluckSignup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rsvpId: 'r-1' },
        orderBy: { claimedAt: 'asc' },
      }),
    );
  });

  it('scopes the lookup to the caller user id', async () => {
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'r-1' });
    prismaMock.potluckSignup.findMany.mockResolvedValue([]);
    const caller = createCaller({ session: userSession });
    await caller.getMySignups({ eventId: 'e-1' });
    expect(prismaMock.rSVP.findUnique).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: 'e-1', userId: 'u-1' } },
      select: { id: true },
    });
  });
});
