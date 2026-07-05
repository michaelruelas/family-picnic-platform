import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  event: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  rSVP: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  dependent: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  household: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  invitation: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  potluckSlot: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  potluckSignup: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  photo: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  photoReaction: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  communicationLog: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    update: vi.fn(),
  },
  scheduledBroadcast: { create: vi.fn(), update: vi.fn() },
  adminAuditLog: { create: vi.fn(), findMany: vi.fn() },
  eventAdmin: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('~/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('~/lib/audit', () => ({
  writeAuditLog: vi.fn(),
  diff: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
  default: vi.fn(),
}));

vi.mock('~/lib/auth', () => ({
  authOptions: {},
  getServerSession: vi.fn(),
}));

vi.mock('~/lib/invitation-token', () => ({
  generateInvitationToken: vi.fn(() => 'MOCK-TOKEN-123'),
  getInvitationExpiry: vi.fn(() => new Date('2099-01-01T00:00:00.000Z')),
}));

vi.mock('~/lib/generated/enums', () => ({
  EventStatus: { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', CLOSED: 'CLOSED', CANCELLED: 'CANCELLED' },
  RSVPStatus: {
    CONFIRMED: 'CONFIRMED',
    DECLINED: 'DECLINED',
    PENDING: 'PENDING',
    WAITLISTED: 'WAITLISTED',
    INVITED: 'INVITED',
  },
  InvitationStatus: {
    PENDING: 'PENDING',
    USED: 'USED',
    EXPIRED: 'EXPIRED',
    SENT: 'SENT',
    DELIVERED: 'DELIVERED',
  },
  CommunicationChannel: { EMAIL: 'EMAIL', SMS: 'SMS' },
  CommunicationStatus: {
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    DELIVERED: 'DELIVERED',
    UNSUBSCRIBED: 'UNSUBSCRIBED',
  },
  CommunicationPreference: { EMAIL: 'EMAIL', SMS: 'SMS', BOTH: 'BOTH', NONE: 'NONE' },
  AdminPermission: { OWNER: 'OWNER', COADMIN: 'COADMIN', INVITER: 'INVITER' },
  PotluckCategory: {
    MAIN: 'MAIN',
    SIDE: 'SIDE',
    DESSERT: 'DESSERT',
    DRINK: 'DRINK',
    OTHER: 'OTHER',
  },
  SlotType: { LIMITED: 'LIMITED', UNLIMITED: 'UNLIMITED' },
}));

vi.mock('~/lib/s3', () => ({
  generatePresignedUploadUrl: vi.fn(() =>
    Promise.resolve({
      uploadUrl: 'https://s3.example.com/upload',
      key: 'events/evt-1/uploads/user-1/123-photo.jpg',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    }),
  ),
  isS3Configured: vi.fn(() => true),
  generateS3Key: vi.fn(() => 'events/evt-1/uploads/user-1/123-photo.jpg'),
}));

vi.mock('~/lib/photo-prism', () => ({
  importPhotoToPhotoPrism: vi.fn(() => Promise.resolve({ id: 'pp-1' })),
  isPhotoPrismConfigured: vi.fn(() => true),
}));

const adminSession = {
  user: {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@x.com',
    role: 'ADMIN' as const,
    householdId: null,
  },
  expires: 'x',
};

const userSession = {
  user: {
    id: 'user-1',
    name: 'User',
    email: 'user@x.com',
    role: 'ADMIN_ADULT' as const,
    householdId: 'h-1',
  },
  expires: 'x',
};

const otherUserSession = {
  user: {
    id: 'user-2',
    name: 'Other',
    email: 'other@x.com',
    role: 'ADMIN_ADULT' as const,
    householdId: 'h-2',
  },
  expires: 'x',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma),
  );
  mockPrisma.communicationLog.count.mockResolvedValue(0);
  mockPrisma.communicationLog.groupBy.mockResolvedValue([]);
});

describe('_app.ts - appRouter', () => {
  it('exports appRouter with all 11 sub-routers', async () => {
    const { appRouter } = await import('~/server/routers/_app');
    expect(appRouter).toBeDefined();
    const def = appRouter._def as unknown as Record<string, unknown>;
    const procedures = (def.procedures as Record<string, unknown>) ?? {};
    const allKeys = new Set(
      [...Object.keys(def), ...Object.keys(procedures)].filter(
        (k) => k !== '_config' && k !== '_errorFormatter',
      ),
    );
    const expected = [
      'auth',
      'household',
      'user',
      'event',
      'invitation',
      'rsvp',
      'potluck',
      'photo',
      'communication',
      'admin',
      'dependent',
    ];
    for (const key of expected) {
      expect(appRouter[key as keyof typeof appRouter]).toBeDefined();
    }
    expect(expected.length).toBe(11);
  });
});

describe('event.router', () => {
  it('getById calls prisma.event.findUnique with correct where clause', async () => {
    const mockEvent = { id: 'evt-1', name: 'Picnic' };
    mockPrisma.event.findUnique.mockResolvedValue(mockEvent);

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    const result = await caller.getById({ id: 'evt-1' });

    expect(mockPrisma.event.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'evt-1' } }),
    );
    expect(result).toEqual(mockEvent);
  });

  it('list returns events list from prisma.event.findMany', async () => {
    const mockEvents = [{ id: 'evt-1', name: 'Picnic', status: 'PUBLISHED' }];
    mockPrisma.event.findMany.mockResolvedValue(mockEvents);

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: userSession });
    const result = await caller.list();

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date: 'desc' } }),
    );
    expect(result).toEqual(mockEvents);
  });

  it('list filters by status when provided', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: userSession });
    await caller.list({ status: 'PUBLISHED' });

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PUBLISHED' } }),
    );
  });

  it('list returns all events when no status filter provided (where undefined)', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: userSession });
    await caller.list();

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('create returns the created event with DRAFT status', async () => {
    const createdEvent = {
      id: 'evt-1',
      name: 'Summer Picnic',
      date: new Date('2026-07-15'),
      location: 'Park',
      description: 'Fun day',
      status: 'DRAFT',
    };
    mockPrisma.event.create.mockResolvedValue(createdEvent);

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    const result = await caller.create({
      name: 'Summer Picnic',
      date: '2026-07-15T12:00:00.000Z',
      location: 'Park',
      description: 'Fun day',
    });

    expect(mockPrisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Summer Picnic',
          location: 'Park',
          description: 'Fun day',
          status: 'DRAFT',
        }),
      }),
    );
    expect(result).toEqual(createdEvent);
  });

  it('create is restricted to admin (auditedAdminProcedure)', async () => {
    mockPrisma.event.create.mockResolvedValue({ id: 'evt-1' });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: userSession });
    await expect(
      caller.create({
        name: 'Test',
        date: new Date().toISOString(),
        location: 'Park',
        description: '',
      }),
    ).rejects.toThrow();
  });

  it('update modifies event fields (name, date, description)', async () => {
    const updatedEvent = {
      id: 'evt-1',
      name: 'Updated Picnic',
      date: new Date('2026-08-01'),
      location: 'Park',
      description: 'Updated description',
    };
    mockPrisma.event.update.mockResolvedValue(updatedEvent);

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    const result = await caller.update({
      id: 'evt-1',
      name: 'Updated Picnic',
      date: '2026-08-01T12:00:00.000Z',
      description: 'Updated description',
    });

    expect(mockPrisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({
          name: 'Updated Picnic',
          description: 'Updated description',
        }),
      }),
    );
    expect(result).toEqual(updatedEvent);
  });

  it('publish updates event status to PUBLISHED', async () => {
    mockPrisma.event.update.mockResolvedValue({ id: 'evt-1', status: 'PUBLISHED' });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    await caller.publish({ id: 'evt-1' });

    expect(mockPrisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });

  it('close calls prisma.event.update with CLOSED status', async () => {
    mockPrisma.event.update.mockResolvedValue({ id: 'evt-1', status: 'CLOSED' });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    await caller.close({ id: 'evt-1' });

    expect(mockPrisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED' }) }),
    );
  });

  it('cancel calls prisma.event.update with CANCELLED status', async () => {
    mockPrisma.event.update.mockResolvedValue({ id: 'evt-1', status: 'CANCELLED' });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    await caller.cancel({ id: 'evt-1' });

    expect(mockPrisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    );
  });

  it('listAdmins calls prisma.eventAdmin.findMany with includes', async () => {
    const mockAdmins = [
      {
        id: 'ea-1',
        userId: 'user-2',
        role: 'COADMIN',
        user: { id: 'user-2', name: 'User 2', email: 'u2@x.com', household: { name: 'Family' } },
      },
    ];
    mockPrisma.eventAdmin.findMany.mockResolvedValue(mockAdmins);

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    const result = await caller.listAdmins({ eventId: 'evt-1' });

    expect(mockPrisma.eventAdmin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1' },
        include: expect.objectContaining({ user: expect.anything() }),
      }),
    );
    expect(result).toEqual(mockAdmins);
  });

  it('addAdmin creates event admin with default COADMIN role', async () => {
    mockPrisma.eventAdmin.create.mockResolvedValue({
      id: 'ea-1',
      eventId: 'evt-1',
      userId: 'user-2',
      role: 'COADMIN',
    });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    const result = await caller.addAdmin({ eventId: 'evt-1', userId: 'user-2' });

    expect(mockPrisma.eventAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'evt-1', userId: 'user-2', role: 'COADMIN' }),
      }),
    );
    expect(result).toEqual({ id: 'ea-1', eventId: 'evt-1', userId: 'user-2', role: 'COADMIN' });
  });

  it('addAdmin with OWNER role creates event admin with OWNER role', async () => {
    mockPrisma.eventAdmin.create.mockResolvedValue({
      id: 'ea-1',
      eventId: 'evt-1',
      userId: 'user-2',
      role: 'OWNER',
    });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    const result = await caller.addAdmin({ eventId: 'evt-1', userId: 'user-2', role: 'OWNER' });

    expect(mockPrisma.eventAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'OWNER' }),
      }),
    );
    expect(result.role).toBe('OWNER');
  });

  it('removeAdmin deletes event admin by composite key', async () => {
    mockPrisma.eventAdmin.delete.mockResolvedValue({ id: 'ea-1' });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    await caller.removeAdmin({ eventId: 'evt-1', userId: 'user-2' });

    expect(mockPrisma.eventAdmin.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'evt-1', userId: 'user-2' } },
      }),
    );
  });

  it('create with rsvpDeadline and maxCapacity passes extra fields', async () => {
    mockPrisma.event.create.mockResolvedValue({ id: 'evt-1' });

    const { eventRouter } = await import('~/server/routers/event.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(eventRouter)({ session: adminSession });
    await caller.create({
      name: 'Event',
      date: '2026-07-15T12:00:00.000Z',
      location: 'Park',
      description: '',
      rsvpDeadline: '2026-07-10T12:00:00.000Z',
      maxCapacity: 100,
    });

    expect(mockPrisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rsvpDeadline: expect.any(Date),
          maxCapacity: 100,
        }),
      }),
    );
  });
});

describe('user.router', () => {
  it('getProfile returns the user by session id with select fields', async () => {
    const mockUser = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@x.com',
      role: 'ADMIN',
      communicationPreference: 'EMAIL',
      household: { id: 'h-1', name: 'Family' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    const result = await caller.getProfile();

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'admin-1' }, select: expect.any(Object) }),
    );
    expect(result).toEqual(mockUser);
  });

  it('getProfile returns null when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    const result = await caller.getProfile();

    expect(result).toBeNull();
  });

  it('updatePreferences updates the user with select fields', async () => {
    const mockUpdated = {
      id: 'admin-1',
      name: 'Updated Admin',
      email: 'admin@x.com',
      communicationPreference: 'EMAIL',
      household: null,
    };
    mockPrisma.user.update.mockResolvedValue(mockUpdated);

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    const result = await caller.updatePreferences({
      name: 'Updated Admin',
      communicationPreference: 'EMAIL',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
        data: expect.objectContaining({ name: 'Updated Admin', communicationPreference: 'EMAIL' }),
        select: expect.any(Object),
      }),
    );
    expect(result).toEqual(mockUpdated);
  });

  it('updatePreferences accepts partial data (name only)', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'admin-1' });

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    await caller.updatePreferences({ name: 'Only Name' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Only Name' }),
      }),
    );
  });

  it('updatePreferences accepts communicationPreference only', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'admin-1' });

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    await caller.updatePreferences({ communicationPreference: 'SMS' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ communicationPreference: 'SMS' }),
      }),
    );
  });

  it('getByHousehold calls prisma.user.findMany with householdId', async () => {
    const mockUsers = [{ id: 'user-1', name: 'User' }];
    mockPrisma.user.findMany.mockResolvedValue(mockUsers);

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    const result = await caller.getByHousehold({ householdId: 'hh-1' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: 'hh-1' }, select: expect.any(Object) }),
    );
    expect(result).toEqual(mockUsers);
  });

  it('getById calls prisma.user.findUnique with select', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    await caller.getById({ id: 'user-5' });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-5' }, select: expect.any(Object) }),
    );
  });

  it('searchByEmail calls prisma.user.findUnique with email select', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    await caller.searchByEmail({ email: 'test@example.com' });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'test@example.com' }, select: expect.any(Object) }),
    );
  });

  it('searchByEmail returns user data when found', async () => {
    const mockUser = {
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      role: 'ADMIN_ADULT',
      household: { id: 'h-1', name: 'Test Fam' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    const result = await caller.searchByEmail({ email: 'test@example.com' });

    expect(result).toEqual(mockUser);
  });

  it('completeOnboarding calls prisma.user.update with onboardingCompletedAt', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'admin-1' });

    const { userRouter } = await import('~/server/routers/user.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(userRouter)({ session: adminSession });
    await caller.completeOnboarding();

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
        data: expect.objectContaining({ onboardingCompletedAt: expect.any(Date) }),
        select: expect.any(Object),
      }),
    );
  });
});

describe('auth.router', () => {
  it('getSession returns the session from ctx', async () => {
    const { authRouter } = await import('~/server/routers/auth.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(authRouter)({ session: userSession });
    const result = await caller.getSession();
    expect(result).toEqual(userSession);
  });
});

describe('dependent.router', () => {
  it('list returns user dependents filtered by managedByUserId and not deleted', async () => {
    const mockDependents = [{ id: 'dep-1', name: 'Alice', relationship: 'CHILD' }];
    mockPrisma.dependent.findMany.mockResolvedValue(mockDependents);

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    const result = await caller.list();

    expect(mockPrisma.dependent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { managedByUserId: 'user-1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(result).toEqual(mockDependents);
  });

  it('list returns empty when user has no dependents', async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([]);

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    const result = await caller.list();

    expect(result).toEqual([]);
  });

  it('create creates dependent with correct household data from user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.dependent.create.mockResolvedValue({
      id: 'dep-1',
      name: 'Alice',
      relationship: 'CHILD',
    });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    const result = await caller.create({ name: 'Alice', relationship: 'CHILD' });

    expect(mockPrisma.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Alice',
          relationship: 'CHILD',
          managedByUserId: 'user-1',
          householdId: 'h-1',
        }),
      }),
    );
    expect(result).toEqual({ id: 'dep-1', name: 'Alice', relationship: 'CHILD' });
  });

  it('create passes optional fields (age, dietaryLabels, isChild)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.dependent.create.mockResolvedValue({ id: 'dep-1' });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    await caller.create({
      name: 'Bob',
      relationship: 'CHILD',
      age: 10,
      dietaryLabels: ['VEGETARIAN'],
      isChild: true,
    });

    expect(mockPrisma.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Bob',
          age: 10,
          dietaryLabels: ['VEGETARIAN'],
          isChild: true,
        }),
      }),
    );
  });

  it('create throws when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });

    await expect(caller.create({ name: 'Alice', relationship: 'CHILD' })).rejects.toThrow(
      'User not found',
    );
  });

  it('create uses user.id as fallback householdId when user has no householdId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: null });
    mockPrisma.dependent.create.mockResolvedValue({ id: 'dep-1' });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    await caller.create({ name: 'Alice', relationship: 'CHILD' });

    expect(mockPrisma.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ householdId: 'user-1' }),
      }),
    );
  });

  it('update updates dependent fields', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue({
      id: 'dep-1',
      managedByUserId: 'user-1',
      deletedAt: null,
    });
    mockPrisma.dependent.update.mockResolvedValue({ id: 'dep-1', name: 'Alice Updated', age: 12 });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    const result = await caller.update({ id: 'dep-1', name: 'Alice Updated', age: 12 });

    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dep-1' },
        data: expect.objectContaining({ name: 'Alice Updated', age: 12 }),
      }),
    );
    expect(result).toEqual({ id: 'dep-1', name: 'Alice Updated', age: 12 });
  });

  it('update throws when dependent not found', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue(null);

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });

    await expect(caller.update({ id: 'dep-missing', name: 'Bob' })).rejects.toThrow(
      'Dependent not found',
    );
  });

  it('update throws when dependent is soft-deleted', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue({
      id: 'dep-1',
      managedByUserId: 'user-1',
      deletedAt: new Date(),
    });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });

    await expect(caller.update({ id: 'dep-1', name: 'Bob' })).rejects.toThrow(
      'Dependent not found',
    );
  });

  it('update throws when user is not the manager', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue({
      id: 'dep-1',
      managedByUserId: 'other-user',
      deletedAt: null,
    });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });

    await expect(caller.update({ id: 'dep-1', name: 'Bob' })).rejects.toThrow('Unauthorized');
  });

  it('delete soft-deletes dependent with deletedAt', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue({
      id: 'dep-1',
      managedByUserId: 'user-1',
      deletedAt: null,
    });
    mockPrisma.dependent.update.mockResolvedValue({ id: 'dep-1', deletedAt: new Date() });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    await caller.delete({ id: 'dep-1' });

    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dep-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('delete throws when dependent not found', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue(null);

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });

    await expect(caller.delete({ id: 'dep-missing' })).rejects.toThrow('Dependent not found');
  });

  it('delete throws when dependent is already soft-deleted', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue({
      id: 'dep-1',
      managedByUserId: 'user-1',
      deletedAt: new Date(),
    });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });

    await expect(caller.delete({ id: 'dep-1' })).rejects.toThrow('Dependent not found');
  });

  it('delete throws when user is not the manager', async () => {
    mockPrisma.dependent.findUnique.mockResolvedValue({
      id: 'dep-1',
      managedByUserId: 'other-user',
      deletedAt: null,
    });

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });

    await expect(caller.delete({ id: 'dep-1' })).rejects.toThrow('Unauthorized');
  });

  it('getByHousehold calls prisma.dependent.findMany with householdId and deletedAt filter', async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([]);

    const { dependentRouter } = await import('~/server/routers/dependent.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(dependentRouter)({ session: userSession });
    await caller.getByHousehold({ householdId: 'hh-1' });

    expect(mockPrisma.dependent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId: 'hh-1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });
});

describe('household.router', () => {
  it('create creates a household with name', async () => {
    mockPrisma.household.create.mockResolvedValue({ id: 'hh-1', name: 'Test Family' });

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    const result = await caller.create({ name: 'Test Family' });

    expect(mockPrisma.household.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Test Family', parentHouseholdId: undefined } }),
    );
    expect(result).toEqual({ id: 'hh-1', name: 'Test Family' });
  });

  it('create with parentHouseholdId passes it to prisma', async () => {
    mockPrisma.household.create.mockResolvedValue({ id: 'hh-2' });

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    await caller.create({ name: 'Child Family', parentHouseholdId: 'hh-1' });

    expect(mockPrisma.household.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Child Family', parentHouseholdId: 'hh-1' } }),
    );
  });

  it('getById returns household with users, dependents, and children', async () => {
    const mockHousehold = {
      id: 'hh-1',
      name: 'Family',
      users: [{ id: 'user-1', name: 'User' }],
      dependents: [{ id: 'dep-1', name: 'Child' }],
      children: [],
    };
    mockPrisma.household.findUnique.mockResolvedValue(mockHousehold);

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    const result = await caller.getById({ id: 'hh-1' });

    expect(mockPrisma.household.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hh-1' },
        include: { users: true, dependents: true, children: true },
      }),
    );
    expect(result).toEqual(mockHousehold);
  });

  it('getTree calls prisma.household.findMany with deletedAt and include', async () => {
    mockPrisma.household.findMany.mockResolvedValue([]);

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    await caller.getTree();

    expect(mockPrisma.household.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        include: expect.objectContaining({
          users: true,
          dependents: true,
          children: expect.anything(),
        }),
      }),
    );
  });

  it('getTree returns only root households (no parentHouseholdId)', async () => {
    mockPrisma.household.findMany.mockResolvedValue([
      { id: 'hh-1', parentHouseholdId: null, users: [], dependents: [], children: [] },
      { id: 'hh-2', parentHouseholdId: 'hh-1', users: [], dependents: [], children: [] },
      { id: 'hh-3', parentHouseholdId: null, users: [], dependents: [], children: [] },
    ]);

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    const result = await caller.getTree();

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('hh-1');
    expect(result[1]!.id).toBe('hh-3');
  });

  it('addMember updates user with householdId', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'user-3', householdId: 'hh-1' });

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    await caller.addMember({ householdId: 'hh-1', userId: 'user-3' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-3' },
        data: { householdId: 'hh-1' },
      }),
    );
  });

  it('removeMember sets householdId to null', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'user-3', householdId: null });

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    await caller.removeMember({ householdId: 'hh-1', userId: 'user-3' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-3' },
        data: { householdId: null },
      }),
    );
  });

  it('list calls prisma.household.findMany with deletedAt and orderBy', async () => {
    mockPrisma.household.findMany.mockResolvedValue([]);

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    await caller.list();

    expect(mockPrisma.household.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        include: { users: true },
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('getCumulativeHeadcount returns aggregated headcount data', async () => {
    const mockRsvps = [
      { headcount: 4, event: { id: 'evt-1', name: 'Picnic', date: new Date('2026-07-15') } },
      { headcount: 2, event: { id: 'evt-2', name: 'BBQ', date: new Date('2026-08-01') } },
    ];
    mockPrisma.rSVP.findMany.mockResolvedValue(mockRsvps);

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    const result = await caller.getCumulativeHeadcount({ householdId: 'hh-1' });

    expect(mockPrisma.rSVP.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId: 'hh-1',
          status: 'CONFIRMED',
          event: expect.objectContaining({
            status: 'PUBLISHED',
            date: { gte: expect.any(Date) },
          }),
        }),
      }),
    );
    expect(result.totalHeadcount).toBe(6);
    expect(result.byEvent).toHaveLength(2);
    expect(result.byEvent[0]!.headcount).toBe(4);
    expect(result.byEvent[1]!.headcount).toBe(2);
  });

  it('getCumulativeHeadcount returns zero when no RSVPs', async () => {
    mockPrisma.rSVP.findMany.mockResolvedValue([]);

    const { householdRouter } = await import('~/server/routers/household.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(householdRouter)({ session: userSession });
    const result = await caller.getCumulativeHeadcount({ householdId: 'hh-1' });

    expect(result.totalHeadcount).toBe(0);
    expect(result.byEvent).toHaveLength(0);
  });
});

describe('rsvp.router', () => {
  it('getByEvent calls prisma.rSVP.findMany with eventId and includes', async () => {
    mockPrisma.rSVP.findMany.mockResolvedValue([]);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await caller.getByEvent({ eventId: 'evt-1' });

    expect(mockPrisma.rSVP.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1' },
        include: expect.objectContaining({ user: expect.anything() }),
        orderBy: { respondedAt: 'desc' },
      }),
    );
  });

  it('getMyRsvp calls prisma.rSVP.findUnique with user id', async () => {
    const mockRsvp = { id: 'rsvp-1', eventId: 'evt-1', userId: 'user-1' };
    mockPrisma.rSVP.findUnique.mockResolvedValue(mockRsvp);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.getMyRsvp({ eventId: 'evt-1' });

    expect(mockPrisma.rSVP.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'evt-1', userId: 'user-1' } },
      }),
    );
    expect(result).toEqual(mockRsvp);
  });

  it('getHeadcount calls prisma.rSVP.aggregate and returns formatted response', async () => {
    mockPrisma.rSVP.aggregate.mockResolvedValue({
      _sum: { headcount: 10 },
      _count: { id: 5 },
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.getHeadcount({ eventId: 'evt-1' });

    expect(result).toEqual({ totalHeadcount: 10, totalRsvps: 5 });
  });

  it('getHeadcount returns zeroes when no RSVPs', async () => {
    mockPrisma.rSVP.aggregate.mockResolvedValue({
      _sum: { headcount: null },
      _count: { id: null },
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.getHeadcount({ eventId: 'evt-1' });

    expect(result).toEqual({ totalHeadcount: 0, totalRsvps: 0 });
  });

  it('confirm creates RSVP for published event with valid deadline', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      rsvpDeadline: futureDate,
      maxCapacity: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.rSVP.upsert.mockResolvedValue({
      id: 'rsvp-1',
      eventId: 'evt-1',
      userId: 'user-1',
      status: 'CONFIRMED',
      headcount: 3,
      dietaryNotes: 'Veggie',
    });
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 1 });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.confirm({ eventId: 'evt-1', headcount: 3, dietaryNotes: 'Veggie' });

    expect(mockPrisma.rSVP.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'evt-1', userId: 'user-1' } },
        create: expect.objectContaining({
          status: 'CONFIRMED',
          headcount: 3,
          dietaryNotes: 'Veggie',
        }),
        update: expect.objectContaining({
          status: 'CONFIRMED',
          headcount: 3,
          dietaryNotes: 'Veggie',
        }),
      }),
    );
    expect(result.isWaitlisted).toBe(false);
  });

  it('confirm waitlists when capacity exceeded', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      rsvpDeadline: futureDate,
      maxCapacity: 5,
    });
    mockPrisma.rSVP.aggregate.mockResolvedValue({ _sum: { headcount: 4 } });
    mockPrisma.rSVP.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.rSVP.upsert.mockResolvedValue({
      id: 'rsvp-1',
      eventId: 'evt-1',
      userId: 'user-1',
      status: 'WAITLISTED',
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.confirm({ eventId: 'evt-1', headcount: 2 });

    expect(result.isWaitlisted).toBe(true);
    expect(result.waitlistPosition).toBe(1);
    expect(mockPrisma.rSVP.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'WAITLISTED' }),
      }),
    );
  });

  it('confirm rejects non-published events', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', status: 'DRAFT' });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.confirm({ eventId: 'evt-1' })).rejects.toThrow(
      'Event is not accepting RSVPs',
    );
  });

  it('confirm rejects expired deadline', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      rsvpDeadline: yesterday,
      maxCapacity: null,
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.confirm({ eventId: 'evt-1' })).rejects.toThrow('RSVP deadline has passed');
  });

  it('confirm rejects when event not found', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.confirm({ eventId: 'evt-1' })).rejects.toThrow('Event not found');
  });

  it('confirm rejects when user not found', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      rsvpDeadline: futureDate,
      maxCapacity: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.confirm({ eventId: 'evt-1' })).rejects.toThrow('User not found');
  });

  it('update modifies headcount and dietaryNotes', async () => {
    mockPrisma.rSVP.update.mockResolvedValue({
      id: 'rsvp-1',
      eventId: 'evt-1',
      userId: 'user-1',
      headcount: 5,
      dietaryNotes: 'Updated',
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.update({ eventId: 'evt-1', headcount: 5, dietaryNotes: 'Updated' });

    expect(mockPrisma.rSVP.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'evt-1', userId: 'user-1' } },
        data: { headcount: 5, dietaryNotes: 'Updated' },
      }),
    );
    expect(result.headcount).toBe(5);
  });

  it('decline cancels RSVP and releases potluck slots', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.rSVP.findUnique
      .mockResolvedValueOnce({
        id: 'rsvp-1',
        status: 'CONFIRMED',
        headcount: 3,
        waitlistPosition: null,
        potluckSignups: [{ id: 'ps-1', slotId: 'slot-1', servings: 2 }],
      })
      .mockResolvedValueOnce({ id: 'rsvp-1', status: 'DECLINED' });
    mockPrisma.rSVP.findFirst.mockResolvedValue(null);
    mockPrisma.rSVP.upsert.mockResolvedValue({ id: 'rsvp-1', status: 'DECLINED' });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.decline({ eventId: 'evt-1' });

    expect(mockPrisma.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: { currentSignups: { decrement: 2 } },
      }),
    );
    expect(mockPrisma.potluckSignup.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rsvpId: 'rsvp-1' } }),
    );
    expect(result?.status).toBe('DECLINED');
  });

  it('decline promotes next waitlisted user when confirming was previous status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.rSVP.findUnique
      .mockResolvedValueOnce({
        id: 'rsvp-1',
        status: 'CONFIRMED',
        headcount: 3,
        waitlistPosition: null,
        potluckSignups: [],
      })
      .mockResolvedValueOnce({ id: 'rsvp-2', status: 'CONFIRMED' });
    mockPrisma.rSVP.findFirst.mockResolvedValue({
      id: 'wl-1',
      userId: 'wl-user',
      waitlistPosition: 1,
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await caller.decline({ eventId: 'evt-1' });

    expect(mockPrisma.rSVP.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wl-1' },
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
    expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'WAITLIST_PROMOTION' }) }),
    );
  });

  it('decline handles waitlist position decrement when user was waitlisted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.rSVP.findUnique
      .mockResolvedValueOnce({
        id: 'rsvp-1',
        status: 'WAITLISTED',
        headcount: 0,
        waitlistPosition: 2,
        potluckSignups: [],
      })
      .mockResolvedValueOnce({ id: 'rsvp-1', status: 'DECLINED' });
    mockPrisma.rSVP.findFirst.mockResolvedValue(null);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await caller.decline({ eventId: 'evt-1' });

    expect(mockPrisma.rSVP.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: 'evt-1',
          status: 'WAITLISTED',
          waitlistPosition: { gt: 2 },
        },
        data: { waitlistPosition: { decrement: 1 } },
      }),
    );
  });

  it('adminOverride creates/updates RSVP for another user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', householdId: 'h-2' });
    mockPrisma.rSVP.upsert.mockResolvedValue({
      id: 'rsvp-admin',
      userId: 'target-user',
      status: 'CONFIRMED',
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: adminSession });
    const result = await caller.adminOverride({
      eventId: 'evt-1',
      userId: 'target-user',
      status: 'CONFIRMED',
      headcount: 4,
    });

    expect(mockPrisma.rSVP.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'evt-1', userId: 'target-user' } },
        create: expect.objectContaining({ status: 'CONFIRMED', headcount: 4 }),
        update: expect.objectContaining({ status: 'CONFIRMED', headcount: 4 }),
      }),
    );
    expect(result.status).toBe('CONFIRMED');
  });

  it('adminOverride declines user RSVP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', householdId: 'h-2' });
    mockPrisma.rSVP.upsert.mockResolvedValue({ id: 'rsvp-admin', status: 'DECLINED' });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: adminSession });
    const result = await caller.adminOverride({
      eventId: 'evt-1',
      userId: 'target-user',
      status: 'DECLINED',
    });

    expect(result.status).toBe('DECLINED');
    expect(mockPrisma.rSVP.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ headcount: 0 }),
      }),
    );
  });

  it('adminOverride throws when target user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: adminSession });
    await expect(
      caller.adminOverride({ eventId: 'evt-1', userId: 'nonexistent', status: 'CONFIRMED' }),
    ).rejects.toThrow('User not found');
  });

  it('create creates RSVP for published event', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      rsvpDeadline: futureDate,
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.rSVP.create.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 1 });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    const result = await caller.create({ eventId: 'evt-1', headcount: 2 });

    expect(mockPrisma.rSVP.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'evt-1', status: 'CONFIRMED' }),
      }),
    );
    expect(result.status).toBe('CONFIRMED');
  });

  it('create rejects when event not found', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.create({ eventId: 'evt-1' })).rejects.toThrow('Event not found');
  });

  it('create rejects non-published event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', status: 'CLOSED' });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.create({ eventId: 'evt-1' })).rejects.toThrow(
      'Event is not accepting RSVPs',
    );
  });

  it('create rejects expired deadline', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      rsvpDeadline: yesterday,
    });

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.create({ eventId: 'evt-1' })).rejects.toThrow('RSVP deadline has passed');
  });

  it('create rejects when user not found', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'PUBLISHED',
      rsvpDeadline: futureDate,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { rsvpRouter } = await import('~/server/routers/rsvp.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(rsvpRouter)({ session: userSession });
    await expect(caller.create({ eventId: 'evt-1' })).rejects.toThrow('User not found');
  });
});

describe('potluck.router', () => {
  it('listSlots calls prisma.potluckSlot.findMany with eventId and includes', async () => {
    mockPrisma.potluckSlot.findMany.mockResolvedValue([]);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.listSlots({ eventId: 'evt-1' });

    expect(mockPrisma.potluckSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1' },
        include: expect.objectContaining({ signups: expect.anything() }),
        orderBy: { category: 'asc' },
      }),
    );
    expect(result).toEqual([]);
  });

  it('getFoodSummary returns categorized food items', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    mockPrisma.potluckSlot.findMany.mockResolvedValue([
      {
        id: 'slot-1',
        category: 'MAIN',
        name: 'Burgers',
        signups: [{ dishName: 'Cheeseburger', servings: 2, rsvp: { id: 'rsvp-1' } }],
      },
      {
        id: 'slot-2',
        category: 'DESSERT',
        name: 'Cake',
        signups: [{ dishName: 'Chocolate Cake', servings: 1, rsvp: { id: 'rsvp-2' } }],
      },
    ]);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.getFoodSummary({ eventId: 'evt-1' });

    expect(mockPrisma.potluckSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1' } }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.category).toBe('MAIN');
    expect(result[0]!.items[0]!).toContain('Cheeseburger');
    expect(result[1]!.category).toBe('DESSERT');
  });

  it('getFoodSummary returns empty array when no slots', async () => {
    mockPrisma.potluckSlot.findMany.mockResolvedValue([]);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.getFoodSummary({ eventId: 'evt-1' });

    expect(result).toEqual([]);
  });

  it('createSlot is restricted to admin', async () => {
    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(
      caller.createSlot({
        eventId: 'evt-1',
        category: 'MAIN',
        name: 'Test',
        slotType: 'UNLIMITED',
      }),
    ).rejects.toThrow();
  });

  it('createSlot creates potluck slot with correct params', async () => {
    mockPrisma.potluckSlot.create.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      category: 'MAIN',
      name: 'Burgers',
      slotType: 'UNLIMITED',
    });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: adminSession });
    const result = await caller.createSlot({
      eventId: 'evt-1',
      category: 'MAIN',
      name: 'Burgers',
      slotType: 'UNLIMITED',
    });

    expect(mockPrisma.potluckSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'evt-1',
          category: 'MAIN',
          name: 'Burgers',
          slotType: 'UNLIMITED',
        }),
      }),
    );
    expect(result.id).toBe('slot-1');
  });

  it('createSlot with LIMITED type sets maxSignups', async () => {
    mockPrisma.potluckSlot.create.mockResolvedValue({
      id: 'slot-1',
      slotType: 'LIMITED',
      maxSignups: 5,
    });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: adminSession });
    await caller.createSlot({
      eventId: 'evt-1',
      category: 'SIDE',
      name: 'Salad',
      slotType: 'LIMITED',
      maxSignups: 5,
    });

    expect(mockPrisma.potluckSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxSignups: 5 }),
      }),
    );
  });

  it('updateSlot updates potluck slot fields', async () => {
    mockPrisma.potluckSlot.update.mockResolvedValue({
      id: 'slot-1',
      name: 'Updated',
      maxSignups: 10,
    });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: adminSession });
    const result = await caller.updateSlot({ id: 'slot-1', name: 'Updated', maxSignups: 10 });

    expect(mockPrisma.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: { name: 'Updated', maxSignups: 10 },
      }),
    );
    expect(result.name).toBe('Updated');
  });

  it('deleteSlot deletes a potluck slot', async () => {
    mockPrisma.potluckSlot.delete.mockResolvedValue({ id: 'slot-1' });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: adminSession });
    await caller.deleteSlot({ id: 'slot-1' });

    expect(mockPrisma.potluckSlot.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'slot-1' } }),
    );
  });

  it('signup creates potluck signup for confirmed RSVP on published event', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      slotType: 'UNLIMITED',
      maxSignups: null,
      event: { status: 'PUBLISHED' },
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.findUnique.mockResolvedValue(null);
    mockPrisma.potluckSignup.create.mockResolvedValue({
      id: 'ps-1',
      slotId: 'slot-1',
      dishName: 'Pasta',
      servings: 2,
    });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.signup({ slotId: 'slot-1', dishName: 'Pasta', servings: 2 });

    expect(mockPrisma.potluckSignup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slotId: 'slot-1',
          rsvpId: 'rsvp-1',
          dishName: 'Pasta',
          servings: 2,
        }),
      }),
    );
    expect(result.dishName).toBe('Pasta');
  });

  it('signup updates existing signup for unlimited slot', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      slotType: 'UNLIMITED',
      maxSignups: null,
      event: { status: 'PUBLISHED' },
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.findUnique.mockResolvedValue({
      id: 'ps-1',
      slotId: 'slot-1',
      rsvpId: 'rsvp-1',
    });
    mockPrisma.potluckSignup.update.mockResolvedValue({
      id: 'ps-1',
      dishName: 'Updated',
      servings: 3,
    });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.signup({ slotId: 'slot-1', dishName: 'Updated', servings: 3 });

    expect(mockPrisma.potluckSignup.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ps-1' } }),
    );
    expect(result.dishName).toBe('Updated');
  });

  it('signup for LIMITED slot uses transaction with serializable isolation', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      slotType: 'LIMITED',
      maxSignups: 3,
      event: { status: 'PUBLISHED' },
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.findUnique.mockResolvedValue(null);
    mockPrisma.potluckSignup.count.mockResolvedValue(2);
    mockPrisma.potluckSignup.create.mockResolvedValue({ id: 'ps-1', dishName: 'Pasta' });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.signup({ slotId: 'slot-1', dishName: 'Pasta', servings: 1 });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result.dishName).toBe('Pasta');
  });

  it('signup throws when slot is full for LIMITED type', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      slotType: 'LIMITED',
      maxSignups: 2,
      event: { status: 'PUBLISHED' },
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.findUnique.mockResolvedValue(null);
    mockPrisma.potluckSignup.count.mockResolvedValue(2);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(
      caller.signup({ slotId: 'slot-1', dishName: 'Pasta', servings: 1 }),
    ).rejects.toThrow('This slot is full');
  });

  it('signup updates existing signup for LIMITED slot using transaction', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      slotType: 'LIMITED',
      maxSignups: 3,
      event: { status: 'PUBLISHED' },
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.findUnique.mockResolvedValue({
      id: 'ps-1',
      slotId: 'slot-1',
      rsvpId: 'rsvp-1',
    });
    mockPrisma.potluckSignup.count.mockResolvedValue(1);
    mockPrisma.potluckSignup.update.mockResolvedValue({ id: 'ps-1', dishName: 'Updated' });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.signup({ slotId: 'slot-1', dishName: 'Updated', servings: 2 });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result.dishName).toBe('Updated');
  });

  it('signup throws when slot not found', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue(null);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(
      caller.signup({ slotId: 'invalid', dishName: 'Pasta', servings: 1 }),
    ).rejects.toThrow('Slot not found');
  });

  it('signup throws when event is not published', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      event: { status: 'DRAFT' },
    });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(
      caller.signup({ slotId: 'slot-1', dishName: 'Pasta', servings: 1 }),
    ).rejects.toThrow('Event is not accepting potluck signups');
  });

  it('signup throws when no confirmed RSVP', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      eventId: 'evt-1',
      event: { status: 'PUBLISHED' },
    });
    mockPrisma.rSVP.findUnique.mockResolvedValue(null);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(
      caller.signup({ slotId: 'slot-1', dishName: 'Pasta', servings: 1 }),
    ).rejects.toThrow('You must have a confirmed RSVP');
  });

  it('updateSignup updates potluck signup', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({ id: 'slot-1', eventId: 'evt-1' });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.update.mockResolvedValue({
      id: 'ps-1',
      dishName: 'Updated',
      servings: 4,
    });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.updateSignup({
      slotId: 'slot-1',
      dishName: 'Updated',
      servings: 4,
      dietaryLabels: ['VEGAN'],
    });

    expect(mockPrisma.potluckSignup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slotId_rsvpId: { slotId: 'slot-1', rsvpId: 'rsvp-1' } },
        data: { dishName: 'Updated', servings: 4, dietaryLabels: ['VEGAN'] },
      }),
    );
    expect(result.dishName).toBe('Updated');
  });

  it('updateSignup throws when RSVP not found', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({ id: 'slot-1', eventId: 'evt-1' });
    mockPrisma.rSVP.findUnique.mockResolvedValue(null);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(
      caller.updateSignup({ slotId: 'slot-1', dishName: 'Test', servings: 2, dietaryLabels: [] }),
    ).rejects.toThrow('RSVP not found');
  });

  it('cancelSignup deletes signup and decrements slot count', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({ id: 'slot-1', eventId: 'evt-1' });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.findUnique.mockResolvedValue({
      id: 'ps-1',
      slotId: 'slot-1',
      rsvpId: 'rsvp-1',
    });
    mockPrisma.potluckSignup.delete.mockResolvedValue({ id: 'ps-1' });
    mockPrisma.potluckSlot.update.mockResolvedValue({ id: 'slot-1' });

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    const result = await caller.cancelSignup({ slotId: 'slot-1' });

    expect(mockPrisma.potluckSignup.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ps-1' } }),
    );
    expect(mockPrisma.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: { currentSignups: { decrement: 1 } },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('cancelSignup throws when slot not found', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue(null);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(caller.cancelSignup({ slotId: 'invalid' })).rejects.toThrow('Slot not found');
  });

  it('cancelSignup throws when RSVP not found', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({ id: 'slot-1', eventId: 'evt-1' });
    mockPrisma.rSVP.findUnique.mockResolvedValue(null);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(caller.cancelSignup({ slotId: 'slot-1' })).rejects.toThrow('RSVP not found');
  });

  it('cancelSignup throws when signup not found', async () => {
    mockPrisma.potluckSlot.findUnique.mockResolvedValue({ id: 'slot-1', eventId: 'evt-1' });
    mockPrisma.rSVP.findUnique.mockResolvedValue({ id: 'rsvp-1', status: 'CONFIRMED' });
    mockPrisma.potluckSignup.findUnique.mockResolvedValue(null);

    const { potluckRouter } = await import('~/server/routers/potluck.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(potluckRouter)({ session: userSession });
    await expect(caller.cancelSignup({ slotId: 'slot-1' })).rejects.toThrow('Signup not found');
  });
});

describe('photo.router', () => {
  it('list returns photos for an event', async () => {
    const mockPhotos = [{ id: 'photo-1', eventId: 'evt-1', url: 'https://example.com/photo.jpg' }];
    mockPrisma.photo.findMany.mockResolvedValue(mockPhotos);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.list({ eventId: 'evt-1' });

    expect(mockPrisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1', deletedAt: null },
        include: expect.objectContaining({ uploadedBy: expect.anything(), reactions: true }),
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result).toEqual(mockPhotos);
  });

  it('search returns photos with pagination', async () => {
    const mockPhotos = [{ id: 'photo-1', caption: 'Test' }];
    mockPrisma.photo.findMany.mockResolvedValue(mockPhotos);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.search({
      query: 'Test',
      eventId: 'evt-1',
      sortBy: 'newest',
      limit: 10,
    });

    expect(mockPrisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          eventId: 'evt-1',
          OR: expect.any(Array),
        }),
      }),
    );
    expect(result.items).toEqual(mockPhotos);
  });

  it('search filters by uploadedByUserId', async () => {
    mockPrisma.photo.findMany.mockResolvedValue([]);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await caller.search({ uploadedByUserId: 'user-1', limit: 10 });

    expect(mockPrisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ uploadedByUserId: 'user-1' }),
      }),
    );
  });

  it('search filters by date range', async () => {
    mockPrisma.photo.findMany.mockResolvedValue([]);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const dateFrom = new Date('2026-01-01');
    const dateTo = new Date('2026-12-31');
    await caller.search({ dateFrom, dateTo, limit: 10 });

    expect(mockPrisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: dateFrom, lte: dateTo },
        }),
      }),
    );
  });

  it('search filters by reaction', async () => {
    mockPrisma.photo.findMany.mockResolvedValue([]);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await caller.search({ reaction: '👍', limit: 10 });

    expect(mockPrisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reactions: { some: { reaction: '👍' } },
        }),
      }),
    );
  });

  it('search sorts by most_reacted', async () => {
    mockPrisma.photo.findMany.mockResolvedValue([]);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await caller.search({ sortBy: 'most_reacted', limit: 10 });

    expect(mockPrisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { reactions: { _count: 'desc' } },
      }),
    );
  });

  it('search handles cursor-based pagination', async () => {
    const photos = Array.from({ length: 11 }, (_, i) => ({ id: `photo-${i + 1}` }));
    mockPrisma.photo.findMany.mockResolvedValue(photos);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.search({ cursor: 'photo-0', limit: 10 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBe('photo-10');
  });

  it('search returns hasMore false when fewer results than limit', async () => {
    const photos = Array.from({ length: 3 }, (_, i) => ({ id: `photo-${i}` }));
    mockPrisma.photo.findMany.mockResolvedValue(photos);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.search({ limit: 10 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeUndefined();
  });

  it('getUploadUrl returns presigned URL data', async () => {
    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.getUploadUrl({
      eventId: 'evt-1',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    });

    expect(result.uploadUrl).toBe('https://s3.example.com/upload');
    expect(result.key).toBeDefined();
    expect(result.expiresAt).toBeDefined();
  });

  it('getUploadUrl throws when S3 is not configured', async () => {
    const { isS3Configured } = await import('~/lib/s3');
    (isS3Configured as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await expect(
      caller.getUploadUrl({ eventId: 'evt-1', filename: 'photo.jpg', contentType: 'image/jpeg' }),
    ).rejects.toThrow('S3 is not configured');
  });

  it('addReaction adds valid reaction to photo', async () => {
    mockPrisma.photo.findUnique.mockResolvedValue({ id: 'photo-1' });
    mockPrisma.photoReaction.findUnique.mockResolvedValue(null);
    mockPrisma.photoReaction.create.mockResolvedValue({ id: 'pr-1' });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.addReaction({ photoId: 'photo-1', reaction: '👍' });

    expect(mockPrisma.photoReaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ photoId: 'photo-1', userId: 'user-1', reaction: '👍' }),
      }),
    );
    expect(result.action).toBe('added');
  });

  it('addReaction returns already_exists when reaction exists', async () => {
    mockPrisma.photo.findUnique.mockResolvedValue({ id: 'photo-1' });
    mockPrisma.photoReaction.findUnique.mockResolvedValue({ id: 'pr-1' });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.addReaction({ photoId: 'photo-1', reaction: '👍' });

    expect(result.action).toBe('already_exists');
  });

  it('addReaction throws for invalid reaction', async () => {
    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await expect(caller.addReaction({ photoId: 'photo-1', reaction: '💩' })).rejects.toThrow(
      'Invalid reaction emoji',
    );
  });

  it('addReaction throws when photo not found', async () => {
    mockPrisma.photo.findUnique.mockResolvedValue(null);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await expect(caller.addReaction({ photoId: 'invalid', reaction: '👍' })).rejects.toThrow(
      'Photo not found',
    );
  });

  it('removeReaction deletes reaction when it exists', async () => {
    mockPrisma.photoReaction.findUnique.mockResolvedValue({ id: 'pr-1' });
    mockPrisma.photoReaction.delete.mockResolvedValue({ id: 'pr-1' });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.removeReaction({ photoId: 'photo-1', reaction: '👍' });

    expect(mockPrisma.photoReaction.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pr-1' } }),
    );
    expect(result.action).toBe('removed');
  });

  it('removeReaction returns not_found when reaction does not exist', async () => {
    mockPrisma.photoReaction.findUnique.mockResolvedValue(null);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.removeReaction({ photoId: 'photo-1', reaction: '👍' });

    expect(result.action).toBe('not_found');
  });

  it('create creates photo record for user with household', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.photo.create.mockResolvedValue({
      id: 'photo-1',
      eventId: 'evt-1',
      url: 'https://example.com/photo.jpg',
    });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.create({
      eventId: 'evt-1',
      photoPrismId: 'pp-1',
      url: 'https://example.com/photo.jpg',
      caption: 'Nice!',
    });

    expect(mockPrisma.photo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'evt-1',
          uploadedByUserId: 'user-1',
          householdId: 'h-1',
        }),
      }),
    );
    expect(result.url).toBe('https://example.com/photo.jpg');
  });

  it('create throws when user has no household', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: null });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await expect(
      caller.create({ eventId: 'evt-1', photoPrismId: 'pp-1', url: 'https://example.com' }),
    ).rejects.toThrow('User must belong to a household');
  });

  it('confirmUpload creates photo record with PhotoPrism integration', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: 'h-1' });
    mockPrisma.photo.create.mockResolvedValue({ id: 'photo-1', url: 'pp-1' });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.confirmUpload({
      eventId: 'evt-1',
      s3Key: 's3-key-1',
      filename: 'photo.jpg',
      caption: 'Yay!',
    });

    expect(mockPrisma.photo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ photoPrismId: 'pp-1' }),
      }),
    );
    expect(result.url).toBe('pp-1');
  });

  it('confirmUpload throws when user has no household', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', householdId: null });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await expect(
      caller.confirmUpload({ eventId: 'evt-1', s3Key: 'key', filename: 'photo.jpg' }),
    ).rejects.toThrow('User must belong to a household');
  });

  it('getById returns photo with includes', async () => {
    const mockPhoto = {
      id: 'photo-1',
      url: 'https://example.com',
      uploadedBy: { id: 'user-1', name: 'User' },
      reactions: [],
      household: { id: 'h-1' },
    };
    mockPrisma.photo.findUnique.mockResolvedValue(mockPhoto);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.getById({ id: 'photo-1' });

    expect(mockPrisma.photo.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'photo-1' },
        include: expect.objectContaining({
          uploadedBy: expect.anything(),
          reactions: true,
          household: true,
        }),
      }),
    );
    expect(result).toEqual(mockPhoto);
  });

  it('delete soft-deletes photo when user is uploader', async () => {
    mockPrisma.photo.findUnique.mockResolvedValue({
      id: 'photo-1',
      uploadedByUserId: 'user-1',
      eventId: 'evt-1',
      caption: 'Test',
      url: 'https://example.com',
      event: { id: 'evt-1' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN_ADULT' });
    mockPrisma.photo.update.mockResolvedValue({ id: 'photo-1', deletedAt: new Date() });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    const result = await caller.delete({ id: 'photo-1' });

    expect(mockPrisma.photo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'photo-1' },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PHOTO_DELETE' }),
      }),
    );
    expect(result.success).toBe(true);
  });

  it('delete allows admin to delete any photo', async () => {
    mockPrisma.photo.findUnique.mockResolvedValue({
      id: 'photo-1',
      uploadedByUserId: 'other-user',
      eventId: 'evt-1',
      caption: 'Test',
      url: 'https://example.com',
      event: { id: 'evt-1' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    mockPrisma.photo.update.mockResolvedValue({ id: 'photo-1', deletedAt: new Date() });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: adminSession });
    const result = await caller.delete({ id: 'photo-1' });

    expect(result.success).toBe(true);
  });

  it('delete throws when photo not found', async () => {
    mockPrisma.photo.findUnique.mockResolvedValue(null);

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await expect(caller.delete({ id: 'invalid' })).rejects.toThrow('Photo not found');
  });

  it('delete throws when user is not uploader nor admin', async () => {
    mockPrisma.photo.findUnique.mockResolvedValue({
      id: 'photo-1',
      uploadedByUserId: 'other-user',
      eventId: 'evt-1',
      caption: 'Test',
      url: 'x',
      event: { id: 'evt-1' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN_ADULT' });

    const { photoRouter } = await import('~/server/routers/photo.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(photoRouter)({ session: userSession });
    await expect(caller.delete({ id: 'photo-1' })).rejects.toThrow(
      'Only the uploader or an admin can delete this photo',
    );
  });
});

describe('invitation.router', () => {
  it('send creates invitation with token and communication log', async () => {
    mockPrisma.invitation.create.mockResolvedValue({
      id: 'inv-1',
      eventId: 'evt-1',
      userId: 'user-1',
      token: 'MOCK-TOKEN-123',
    });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    const result = await caller.send({ eventId: 'evt-1', userId: 'user-1', channel: 'EMAIL' });

    expect(mockPrisma.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'evt-1',
          userId: 'user-1',
          status: 'PENDING',
          token: 'MOCK-TOKEN-123',
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientUserId: 'user-1' }),
      }),
    );
    expect(result.token).toBe('MOCK-TOKEN-123');
  });

  it('send with householdId creates communication logs for all household users', async () => {
    mockPrisma.invitation.create.mockResolvedValue({ id: 'inv-1' });
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await caller.send({ eventId: 'evt-1', householdId: 'h-1', channel: 'EMAIL' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: 'h-1' } }),
    );
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledTimes(2);
  });

  it('send throws when neither householdId nor userId provided', async () => {
    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await expect(caller.send({ eventId: 'evt-1', channel: 'EMAIL' } as any)).rejects.toThrow(
      'Either householdId or userId must be provided',
    );
  });

  it('resend updates invitation status to PENDING', async () => {
    mockPrisma.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'PENDING' });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    const result = await caller.resend({ id: 'inv-1' });

    expect(mockPrisma.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' }, data: { status: 'PENDING' } }),
    );
    expect(result.status).toBe('PENDING');
  });

  it('trackDelivery updates invitation delivery status', async () => {
    mockPrisma.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'DELIVERED' });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await caller.trackDelivery({ id: 'inv-1', status: 'DELIVERED' });

    expect(mockPrisma.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: 'DELIVERED', sentAt: expect.any(Date) }),
      }),
    );
  });

  it('getByEvent returns invitations for an event', async () => {
    mockPrisma.invitation.findMany.mockResolvedValue([]);

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await caller.getByEvent({ eventId: 'evt-1' });

    expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1' },
        include: { household: true, user: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('getByHousehold returns invitations for a household', async () => {
    mockPrisma.invitation.findMany.mockResolvedValue([]);

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await caller.getByHousehold({ householdId: 'h-1' });

    expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId: 'h-1' },
        include: { event: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('consume marks invitation as used', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      expiresAt: new Date('2099-01-01'),
      token: 'tok',
    });
    mockPrisma.invitation.update.mockResolvedValue({
      id: 'inv-1',
      status: 'USED',
      event: {},
      household: {},
      user: {},
    });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    const result = await caller.consume({ token: 'tok' });

    expect(mockPrisma.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' }, data: { status: 'USED' } }),
    );
    expect(result.status).toBe('USED');
  });

  it('consume throws when invitation not found', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(null);

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await expect(caller.consume({ token: 'invalid' })).rejects.toThrow('Invitation not found');
  });

  it('consume throws when invitation already used', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'USED',
      expiresAt: new Date('2099-01-01'),
    });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await expect(caller.consume({ token: 'tok' })).rejects.toThrow(
      'This invitation has already been used',
    );
  });

  it('consume throws when invitation expired by status', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'EXPIRED',
      expiresAt: new Date('2099-01-01'),
    });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await expect(caller.consume({ token: 'tok' })).rejects.toThrow('This invitation has expired');
  });

  it('consume throws when invitation expired by date', async () => {
    const pastDate = new Date(Date.now() - 86400000);
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      expiresAt: pastDate,
      token: 'tok',
    });

    const { invitationRouter } = await import('~/server/routers/invitation.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(invitationRouter)({ session: adminSession });
    await expect(caller.consume({ token: 'tok' })).rejects.toThrow('This invitation has expired');
  });
});

describe('communication.router', () => {
  it('getRateLimitStatus returns rate limit data', async () => {
    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    const result = await caller.getRateLimitStatus();

    expect(result).toBeDefined();
    expect(result.broadcasts).toBeDefined();
    expect(result.recipientGroup).toBeDefined();
    expect(result.recipient).toBeDefined();
  });

  it('sendBroadcast sends to ALL users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    const result = await caller.sendBroadcast({
      eventId: 'evt-1',
      message: 'Hello',
      channel: 'EMAIL',
      recipientType: 'ALL',
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: { not: null } } }),
    );
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('sendBroadcast sends to NOT_RESPONDED users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    const result = await caller.sendBroadcast({
      eventId: 'evt-1',
      message: 'Reminder',
      channel: 'EMAIL',
      recipientType: 'NOT_RESPONDED',
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rsvps: { none: { eventId: 'evt-1', status: { in: ['CONFIRMED', 'DECLINED'] } } },
        }),
      }),
    );
    expect(result.count).toBe(1);
  });

  it('sendBroadcast sends to HOUSEHOLD recipients', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    const result = await caller.sendBroadcast({
      eventId: 'evt-1',
      message: 'Hi',
      channel: 'SMS',
      recipientType: 'HOUSEHOLD',
      recipientIds: ['h-1', 'h-2'],
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: { in: ['h-1', 'h-2'] } } }),
    );
    expect(result.count).toBe(2);
  });

  it('sendBroadcast sends to INDIVIDUAL recipients', async () => {
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    const result = await caller.sendBroadcast({
      eventId: 'evt-1',
      message: 'Hi',
      channel: 'EMAIL',
      recipientType: 'INDIVIDUAL',
      recipientIds: ['u1', 'u2'],
    });

    expect(mockPrisma.communicationLog.create).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(2);
  });

  it('sendBroadcast throws when recipientIds missing for HOUSEHOLD', async () => {
    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    await expect(
      caller.sendBroadcast({
        eventId: 'evt-1',
        message: 'Hi',
        channel: 'EMAIL',
        recipientType: 'HOUSEHOLD',
      }),
    ).rejects.toThrow('recipientIds required for HOUSEHOLD type');
  });

  it('scheduleMessage creates a scheduled broadcast', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7);
    mockPrisma.scheduledBroadcast.create.mockResolvedValue({ id: 'sb-1', scheduledAt: futureDate });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    const result = await caller.scheduleMessage({
      eventId: 'evt-1',
      message: 'Scheduled',
      channel: 'EMAIL',
      scheduledAt: futureDate.toISOString(),
      recipientType: 'ALL',
    });

    expect(mockPrisma.scheduledBroadcast.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'evt-1', message: 'Scheduled' }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.id).toBe('sb-1');
  });

  it('scheduleMessage throws on invalid date', async () => {
    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    await expect(
      caller.scheduleMessage({
        eventId: 'evt-1',
        message: 'Test',
        channel: 'EMAIL',
        scheduledAt: 'totally-invalid',
        recipientType: 'ALL',
      }),
    ).rejects.toThrow();
  });

  it('getDeliveryStatus returns communication logs for an event', async () => {
    mockPrisma.communicationLog.findMany.mockResolvedValue([]);

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: adminSession });
    await caller.getDeliveryStatus({ eventId: 'evt-1' });

    expect(mockPrisma.communicationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1' },
        include: { recipient: { select: { id: true, name: true, email: true } } },
        orderBy: { attemptedAt: 'desc' },
      }),
    );
  });

  it('unsubscribe updates communication preference and logs', async () => {
    mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1' });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', communicationPreference: 'EMAIL' });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: userSession });
    const result = await caller.unsubscribe({ userId: 'user-1', channel: 'SMS' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { communicationPreference: 'EMAIL' },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('unsubscribe with EMAIL channel sets NONE', async () => {
    mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1' });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: userSession });
    await caller.unsubscribe({ userId: 'user-1', channel: 'EMAIL' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { communicationPreference: 'NONE' } }),
    );
  });

  it('unsubscribe throws when userId does not match session', async () => {
    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: userSession });
    await expect(caller.unsubscribe({ userId: 'other-user', channel: 'EMAIL' })).rejects.toThrow(
      'Unauthorized',
    );
  });

  it('getMyPreferences returns user communication preference', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ communicationPreference: 'EMAIL' });

    const { communicationRouter } = await import('~/server/routers/communication.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(communicationRouter)({ session: userSession });
    const result = await caller.getMyPreferences();

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(result).toEqual({ communicationPreference: 'EMAIL' });
  });
});

describe('admin.router', () => {
  it('auditLog returns formatted audit log entries', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        action: 'event.create',
        createdAt: new Date('2026-07-01'),
        user: { id: 'admin-1', name: 'Admin', email: 'admin@x.com' },
        event: { id: 'evt-1', name: 'Picnic' },
        oldValue: null,
        newValue: null,
        userId: 'admin-1',
        eventId: 'evt-1',
      },
    ];
    mockPrisma.adminAuditLog.findMany.mockResolvedValue(mockLogs);

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.auditLog();

    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
    expect(result).toEqual(mockLogs);
  });

  it('auditLog filters by eventId', async () => {
    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.auditLog({ eventId: 'evt-1' });

    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1', userId: undefined, action: undefined },
      }),
    );
  });

  it('auditLog filters by userId', async () => {
    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.auditLog({ userId: 'user-1' });

    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('auditLog filters by action (contains search)', async () => {
    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await caller.auditLog({ action: 'create' });

    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: { contains: 'create' } },
      }),
    );
  });

  it('dashboard returns event dashboard with RSVP summary and food summary', async () => {
    const mockEvent = { id: 'evt-1', name: 'Picnic', date: new Date('2026-07-15') };
    const mockRsvps = [
      {
        id: 'rsvp-1',
        status: 'CONFIRMED',
        headcount: 4,
        user: { id: 'u1', name: 'A', email: 'a@x.com' },
      },
      {
        id: 'rsvp-2',
        status: 'DECLINED',
        headcount: 0,
        user: { id: 'u2', name: 'B', email: 'b@x.com' },
      },
      {
        id: 'rsvp-3',
        status: 'PENDING',
        headcount: 0,
        user: { id: 'u3', name: 'C', email: 'c@x.com' },
      },
    ];
    const mockSlots = [
      {
        id: 'slot-1',
        category: 'MAIN',
        signups: [{ dishName: 'Burgers', servings: 2, rsvp: { status: 'CONFIRMED' } }],
      },
    ];

    mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
    mockPrisma.rSVP.findMany.mockResolvedValue(mockRsvps);
    mockPrisma.potluckSlot.findMany.mockResolvedValue(mockSlots);

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.dashboard({ eventId: 'evt-1' });

    expect(result.event).toEqual(mockEvent);
    expect(result.rsvpSummary.total).toBe(3);
    expect(result.rsvpSummary.confirmed).toBe(1);
    expect(result.rsvpSummary.declined).toBe(1);
    expect(result.rsvpSummary.pending).toBe(1);
    expect(result.rsvpSummary.headcount).toBe(4);
    expect(result.foodSummary).toHaveLength(1);
    expect(result.foodSummary[0]!.items[0]!).toContain('Burgers');
  });

  it('dashboard throws when event not found', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    await expect(caller.dashboard({ eventId: 'invalid' })).rejects.toThrow('Event not found');
  });

  it('inviteFromPrevious creates invitations from previous RSVPs', async () => {
    mockPrisma.rSVP.findMany.mockResolvedValue([
      { userId: 'u1', householdId: 'h-1', user: { id: 'u1' } },
      { userId: 'u2', householdId: 'h-2', user: { id: 'u2' } },
    ]);
    mockPrisma.invitation.create.mockResolvedValue({ id: 'inv-1' });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.inviteFromPrevious({ fromEventId: 'evt-1', toEventId: 'evt-2' });

    expect(mockPrisma.rSVP.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1', status: 'CONFIRMED' },
        include: { user: true },
      }),
    );
    expect(mockPrisma.invitation.create).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('csvImport creates households, users, and RSVPs from CSV data', async () => {
    mockPrisma.household.create.mockResolvedValue({ id: 'new-hh-1' });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'new-user-1', email: 'new@x.com' });
    mockPrisma.user.create.mockResolvedValue({ id: 'new-user-1' });
    mockPrisma.rSVP.create.mockResolvedValue({ id: 'rsvp-1' });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.csvImport({
      eventId: 'evt-1',
      households: [
        {
          name: 'Smith Family',
          members: [{ email: 'john@smith.com', name: 'John', headcount: 3 }],
        },
      ],
    });

    expect(result.householdsCreated).toBe(1);
    expect(result.usersCreated).toBe(1);
    expect(result.rsvpsCreated).toBe(1);
  });

  it('csvImport reuses existing users by email', async () => {
    mockPrisma.household.create.mockResolvedValue({ id: 'new-hh-1' });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'existing-user',
      email: 'existing@x.com',
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'existing-user' });
    mockPrisma.rSVP.create.mockResolvedValue({ id: 'rsvp-1' });

    const { adminRouter } = await import('~/server/routers/admin.router');
    const { createCallerFactory } = await import('~/lib/trpc');
    const caller = createCallerFactory(adminRouter)({ session: adminSession });
    const result = await caller.csvImport({
      eventId: 'evt-1',
      households: [
        {
          name: 'Existing Family',
          members: [{ email: 'existing@x.com', name: 'Existing', headcount: 2 }],
        },
      ],
    });

    expect(result.householdsCreated).toBe(1);
    expect(result.usersCreated).toBe(0);
    expect(result.rsvpsCreated).toBe(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-user' },
        data: { householdId: 'new-hh-1' },
      }),
    );
  });
});
