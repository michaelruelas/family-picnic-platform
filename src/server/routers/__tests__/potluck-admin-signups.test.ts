import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const tx = {
    potluckSignup: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    potluckSlot: {
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  return {
    potluckSlot: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    potluckSignup: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    rSVP: {
      findUnique: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    // FPP-65 / QUB-13.1: canAccessEvent (called inside the
    // eventAdminProcedure gate when isAdminRole is false) reads
    // `eventAdmin.findUnique`. Default to null so a non-admin
    // session is correctly denied.
    eventAdmin: {
      findUnique: vi.fn(() => Promise.resolve(null)),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    _tx: tx,
  };
});

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('~/lib/audit', () => ({
  writeDomainAuditLog: vi.fn(
    async (
      entry: { action: string; subjectType: string; subjectId: string; payload?: unknown },
      tx: { auditLog: { create: (args: { data: typeof entry }) => Promise<unknown> } },
    ) => {
      await tx.auditLog.create({ data: entry });
    },
  ),
  writeAuditLog: vi.fn(),
  diff: vi.fn(),
}));

vi.mock('~/lib/auth', () => ({
  authOptions: {},
  getServerSession: vi.fn(),
  // SUPER_ADMIN / ADMIN pass the `isAdminRole` branch of
  // eventAdminProcedure, so admin sessions reach the procedures
  // without setting up an EventAdmin row.
  isAdminRole: (role: unknown) => role === 'SUPER_ADMIN' || role === 'ADMIN',
  isSuperAdminRole: (role: unknown) => role === 'SUPER_ADMIN',
}));

const { potluckRouter } = await import('~/server/routers/potluck.router');
const { createCallerFactory } = await import('~/lib/trpc');

const createCaller = createCallerFactory(potluckRouter);

const adminSession = {
  user: {
    id: 'admin-1',
    email: 'admin@x.com',
    name: 'Admin',
    role: 'ADMIN' as const,
    householdId: null,
  },
  expires: '2099-01-01',
};

const userSession = {
  user: {
    id: 'user-1',
    email: 'u@x.com',
    name: 'User',
    role: 'ADULT' as const,
    householdId: 'h-1',
  },
  expires: '2099-01-01',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('potluck.adminListSignups', () => {
  it('requires an authenticated session', async () => {
    const caller = createCaller({ session: null });
    await expect(caller.adminListSignups({ eventId: 'evt-1' })).rejects.toThrow();
  });

  it('scopes the query to the event and filters soft-deleted signups', async () => {
    prismaMock.potluckSlot.findMany.mockResolvedValue([]);

    const caller = createCaller({ session: adminSession });
    await caller.adminListSignups({ eventId: 'evt-1' });

    expect(prismaMock.potluckSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1' },
        include: expect.objectContaining({
          signups: expect.objectContaining({
            where: { deletedAt: null },
          }),
        }),
      }),
    );
  });

  it('rejects non-admin callers (ADULT role) with FORBIDDEN', async () => {
    const caller = createCaller({ session: userSession });
    await expect(caller.adminListSignups({ eventId: 'evt-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('potluck.adminGetSignup', () => {
  it('returns the signup with household identity for the edit modal', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Cake',
        servings: 2,
        dietaryLabels: ['vegetarian'],
        deletedAt: null,
        rsvp: {
          user: {
            id: 'user-1',
            name: 'Maria',
            household: { id: 'h-1', name: 'The Garcias' },
          },
        },
      });

    const caller = createCaller({ session: adminSession });
    const result = await caller.adminGetSignup({ signupId: 'ps-1' });

    expect(result).toEqual({
      id: 'ps-1',
      dishName: 'Cake',
      servings: 2,
      dietaryLabels: ['vegetarian'],
      householdName: 'The Garcias',
      userName: 'Maria',
    });
  });

  it('falls back to user name when the household is missing', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Cake',
        servings: 1,
        dietaryLabels: [],
        deletedAt: null,
        rsvp: {
          user: { id: 'user-1', name: 'Solo', household: null },
        },
      });

    const caller = createCaller({ session: adminSession });
    const result = await caller.adminGetSignup({ signupId: 'ps-1' });
    expect(result.householdName).toBe('Solo');
  });

  it('refuses to return a soft-deleted signup', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Cake',
        servings: 1,
        dietaryLabels: [],
        deletedAt: new Date('2026-08-19T20:00:00Z'),
        rsvp: {
          user: { id: 'user-1', name: 'Maria', household: null },
        },
      });

    const caller = createCaller({ session: adminSession });
    await expect(caller.adminGetSignup({ signupId: 'ps-1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws NOT_FOUND when the signup does not exist', async () => {
    prismaMock.potluckSignup.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller({ session: adminSession });
    await expect(caller.adminGetSignup({ signupId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects non-admin callers', async () => {
    prismaMock.potluckSignup.findUnique.mockResolvedValueOnce({ slot: { eventId: 'evt-1' } });
    const caller = createCaller({ session: userSession });
    await expect(caller.adminGetSignup({ signupId: 'ps-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('potluck.adminUpdateSignup', () => {
  it('writes the new dish fields and a domain audit log row', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Original',
        servings: 2,
        dietaryLabels: [],
        deletedAt: null,
        slot: { eventId: 'evt-1' },
      });
    prismaMock._tx.potluckSignup.update.mockResolvedValue({
      id: 'ps-1',
      dishName: 'Updated',
      servings: 4,
      dietaryLabels: ['VEGAN'],
    });

    const caller = createCaller({ session: adminSession });
    const result = await caller.adminUpdateSignup({
      signupId: 'ps-1',
      dishName: 'Updated',
      servings: 4,
      dietaryLabels: ['VEGAN'],
    });

    expect(result.dishName).toBe('Updated');
    expect(prismaMock._tx.potluckSignup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ps-1' },
        data: { dishName: 'Updated', servings: 4, dietaryLabels: ['VEGAN'] },
      }),
    );
    expect(prismaMock._tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'potluck.signup.admin.update',
          subjectType: 'PotluckSignup',
          subjectId: 'ps-1',
        }),
      }),
    );
  });

  it('refuses to update a soft-deleted signup', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Original',
        servings: 2,
        dietaryLabels: [],
        deletedAt: new Date('2026-08-19T20:00:00Z'),
        slot: { eventId: 'evt-1' },
      });

    const caller = createCaller({ session: adminSession });
    await expect(
      caller.adminUpdateSignup({
        signupId: 'ps-1',
        dishName: 'Updated',
        servings: 4,
        dietaryLabels: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NOT_FOUND when the signup does not exist', async () => {
    prismaMock.potluckSignup.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller({ session: adminSession });
    await expect(
      caller.adminUpdateSignup({
        signupId: 'missing',
        dishName: 'Test',
        servings: 1,
        dietaryLabels: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects non-admin callers', async () => {
    // The eventAdminProcedure gate looks up the signup via
    // getEventId before running the auth check. Seed the lookup
    // so the gate is the thing that fails FORBIDDEN (not the
    // NOT_FOUND thrown inside getEventId).
    prismaMock.potluckSignup.findUnique.mockResolvedValueOnce({ slot: { eventId: 'evt-1' } });
    const caller = createCaller({ session: userSession });
    await expect(
      caller.adminUpdateSignup({
        signupId: 'ps-1',
        dishName: 'X',
        servings: 1,
        dietaryLabels: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('potluck.adminCancelSignup', () => {
  it('soft-deletes the signup, decrements the counter, and writes audit', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Salad',
        servings: 2,
        dietaryLabels: ['vegetarian'],
        deletedAt: null,
        slot: { eventId: 'evt-1' },
      });
    prismaMock._tx.potluckSignup.update.mockResolvedValue({ id: 'ps-1' });

    const caller = createCaller({ session: adminSession });
    const result = await caller.adminCancelSignup({ signupId: 'ps-1' });

    expect(result.success).toBe(true);
    expect(prismaMock._tx.potluckSignup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ps-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(prismaMock._tx.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: { currentSignups: { decrement: 1 } },
      }),
    );
    expect(prismaMock._tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'potluck.signup.admin.cancel',
          subjectId: 'ps-1',
        }),
      }),
    );
  });

  it('refuses to cancel an already soft-deleted signup', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Salad',
        servings: 2,
        dietaryLabels: [],
        deletedAt: new Date('2026-08-19T20:00:00Z'),
        slot: { eventId: 'evt-1' },
      });

    const caller = createCaller({ session: adminSession });
    await expect(caller.adminCancelSignup({ signupId: 'ps-1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prismaMock._tx.potluckSignup.update).not.toHaveBeenCalled();
  });

  it('rejects non-admin callers', async () => {
    // Seed the gate's getEventId lookup so the gate is the thing
    // that fails FORBIDDEN (see the adminUpdateSignup test for the
    // same pattern).
    prismaMock.potluckSignup.findUnique.mockResolvedValueOnce({ slot: { eventId: 'evt-1' } });
    const caller = createCaller({ session: userSession });
    await expect(caller.adminCancelSignup({ signupId: 'ps-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('potluck.adminCreateSignup', () => {
  it('creates a signup on behalf of an RSVP and writes audit', async () => {
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      slotType: 'UNLIMITED',
      event: { id: 'evt-1', name: 'Picnic' },
    });
    prismaMock.rSVP.findUnique.mockResolvedValue({
      id: 'rsvp-1',
      eventId: 'evt-1',
    });
    prismaMock._tx.potluckSignup.create.mockResolvedValue({ id: 'ps-new' });

    const caller = createCaller({ session: adminSession });
    const result = await caller.adminCreateSignup({
      eventId: 'evt-1',
      slotId: 'slot-1',
      rsvpId: 'rsvp-1',
      dishName: 'Pasta',
      servings: 3,
      dietaryLabels: ['vegetarian'],
    });

    expect(result.id).toBe('ps-new');
    expect(prismaMock._tx.potluckSignup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slotId: 'slot-1',
          rsvpId: 'rsvp-1',
          dishName: 'Pasta',
          servings: 3,
          dietaryLabels: ['vegetarian'],
        }),
      }),
    );
    expect(prismaMock._tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'potluck.signup.admin.create',
          subjectType: 'PotluckSignup',
          subjectId: 'ps-new',
          payload: expect.objectContaining({
            onBehalfOf: true,
            rsvpId: 'rsvp-1',
          }),
        }),
      }),
    );
  });

  it('rejects when the slot does not belong to the event', async () => {
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'different-event',
      slotType: 'UNLIMITED',
      event: { id: 'different-event', name: 'X' },
    });

    const caller = createCaller({ session: adminSession });
    await expect(
      caller.adminCreateSignup({
        eventId: 'evt-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Pasta',
        servings: 1,
        dietaryLabels: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects when the RSVP does not belong to the event', async () => {
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      slotType: 'UNLIMITED',
      event: { id: 'evt-1', name: 'Picnic' },
    });
    prismaMock.rSVP.findUnique.mockResolvedValue({
      id: 'rsvp-1',
      eventId: 'different-event',
    });

    const caller = createCaller({ session: adminSession });
    await expect(
      caller.adminCreateSignup({
        eventId: 'evt-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Pasta',
        servings: 1,
        dietaryLabels: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects non-admin callers', async () => {
    const caller = createCaller({ session: userSession });
    await expect(
      caller.adminCreateSignup({
        eventId: 'evt-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Pasta',
        servings: 1,
        dietaryLabels: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('potluck.adminReassignSignup', () => {
  it('no-ops when the slot and rsvp are unchanged', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Cake',
        servings: 1,
        dietaryLabels: [],
        deletedAt: null,
        slot: { eventId: 'evt-1' },
      });

    const caller = createCaller({ session: adminSession });
    const result = await caller.adminReassignSignup({
      signupId: 'ps-1',
      slotId: 'slot-1',
      rsvpId: 'rsvp-1',
    });

    expect(result.id).toBe('ps-1');
    expect(prismaMock._tx.potluckSignup.update).not.toHaveBeenCalled();
    expect(prismaMock._tx.potluckSlot.update).not.toHaveBeenCalled();
  });

  it('updates the signup and adjusts both slot counters', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Cake',
        servings: 1,
        dietaryLabels: [],
        deletedAt: null,
        slot: { eventId: 'evt-1' },
      });
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      eventId: 'evt-1',
      slotType: 'UNLIMITED',
      maxSignups: null,
    });
    prismaMock.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-2', eventId: 'evt-1' });
    prismaMock._tx.potluckSignup.update.mockResolvedValue({
      id: 'ps-1',
      slotId: 'slot-2',
      rsvpId: 'rsvp-2',
    });

    const caller = createCaller({ session: adminSession });
    await caller.adminReassignSignup({
      signupId: 'ps-1',
      slotId: 'slot-2',
      rsvpId: 'rsvp-2',
    });

    expect(prismaMock._tx.potluckSignup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ps-1' },
        data: { slotId: 'slot-2', rsvpId: 'rsvp-2' },
      }),
    );
    expect(prismaMock._tx.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: { currentSignups: { decrement: 1 } },
      }),
    );
    expect(prismaMock._tx.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-2' },
        data: { currentSignups: { increment: 1 } },
      }),
    );
    expect(prismaMock._tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'potluck.signup.admin.reassign',
          subjectId: 'ps-1',
        }),
      }),
    );
  });

  it('rejects when the destination slot is on a different event', async () => {
    prismaMock.potluckSignup.findUnique
      .mockResolvedValueOnce({ slot: { eventId: 'evt-1' } })
      .mockResolvedValueOnce({
        id: 'ps-1',
        slotId: 'slot-1',
        rsvpId: 'rsvp-1',
        dishName: 'Cake',
        servings: 1,
        dietaryLabels: [],
        deletedAt: null,
        slot: { eventId: 'evt-1' },
      });
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      eventId: 'other-event',
      slotType: 'UNLIMITED',
      maxSignups: null,
    });

    const caller = createCaller({ session: adminSession });
    await expect(
      caller.adminReassignSignup({
        signupId: 'ps-1',
        slotId: 'slot-2',
        rsvpId: 'rsvp-1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects non-admin callers', async () => {
    prismaMock.potluckSignup.findUnique.mockResolvedValueOnce({ slot: { eventId: 'evt-1' } });
    const caller = createCaller({ session: userSession });
    await expect(
      caller.adminReassignSignup({
        signupId: 'ps-1',
        slotId: 'slot-2',
        rsvpId: 'rsvp-2',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
