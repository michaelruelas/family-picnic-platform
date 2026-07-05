import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('~/lib/prisma', () => ({
  prisma: {
    adminAuditLog: { create: vi.fn() },
  },
}));

vi.mock('~/lib/audit', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
  default: vi.fn(),
}));

vi.mock('~/lib/auth', () => ({
  authOptions: {},
  getServerSession: vi.fn(),
}));

describe('authRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSession procedure returns ctx.session', async () => {
    const { createCallerFactory } = await import('~/lib/trpc');
    const { authRouter } = await import('~/server/routers/auth.router');

    const createCaller = createCallerFactory(authRouter);
    const mockSession = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'ADMIN' as const,
        householdId: null,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };

    const caller = createCaller({ session: mockSession });
    const result = await caller.getSession();
    expect(result).toEqual(mockSession);
  });

  it('is created as a valid router', async () => {
    const { authRouter } = await import('~/server/routers/auth.router');
    expect(authRouter).toBeDefined();
    expect(typeof authRouter._def).toBe('object');
  });
});
