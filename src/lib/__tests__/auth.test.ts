import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn((config: Record<string, unknown>) => ({
    id: 'google',
    name: 'Google',
    ...config,
  })),
}));

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn((config: Record<string, unknown>) => ({
    id: config.id || 'dev-credentials',
    name: config.name || 'Dev Credentials',
    ...config,
  })),
}));

vi.mock('~/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('Auth module exports', () => {
  it('exports authOptions and getServerSession', async () => {
    const mod = await import('../auth');
    expect(mod.authOptions).toBeDefined();
    expect(typeof mod.getServerSession).toBe('function');
  });

  it('exports getServerSession from next-auth', async () => {
    const { getServerSession } = await import('../auth');
    expect(typeof getServerSession).toBe('function');
  });
});

describe('authOptions configuration', () => {
  it('has Google provider configured', async () => {
    vi.stubEnv('AUTH_GOOGLE_ID', 'google-client-id');
    vi.stubEnv('AUTH_GOOGLE_SECRET', 'google-client-secret');
    const { authOptions } = await import('../auth');
    const googleProvider = authOptions.providers.find((p) => p.id === 'google');
    expect(googleProvider).toBeDefined();
    expect(googleProvider!.id).toBe('google');
    expect(googleProvider!.name).toBe('Google');
  });

  it('passes Google OAuth credentials to GoogleProvider', async () => {
    vi.stubEnv('AUTH_GOOGLE_ID', 'my-google-id');
    vi.stubEnv('AUTH_GOOGLE_SECRET', 'my-google-secret');
    const { authOptions } = await import('../auth');
    const googleProvider = authOptions.providers.find((p) => p.id === 'google') as any;
    expect(googleProvider.clientId).toBe('my-google-id');
    expect(googleProvider.clientSecret).toBe('my-google-secret');
  });

  it('has signIn page set to /login', async () => {
    const { authOptions } = await import('../auth');
    expect(authOptions.pages?.signIn).toBe('/login');
  });

  it('has session and signIn callbacks defined', async () => {
    const { authOptions } = await import('../auth');
    expect(typeof authOptions.callbacks?.session).toBe('function');
    expect(typeof authOptions.callbacks?.signIn).toBe('function');
  });
});

describe('authOptions session callback', () => {
  it('enriches session user with id, role, and householdId from database', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-42',
      role: 'ADMIN',
      householdId: 'house-1',
    } as any);
    const { authOptions } = await import('../auth');
    const sessionCallback = authOptions.callbacks!.session as unknown as (
      params: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
    const session = { user: { name: 'Test', email: 'test@example.com' }, expires: 'some-date' };
    const result = await sessionCallback({ session, token: { sub: 'user-42' } });
    const user = (result as any).user;
    expect(user.id).toBe('user-42');
    expect(user.role).toBe('ADMIN');
    expect(user.householdId).toBe('house-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-42' },
      select: { id: true, role: true, householdId: true },
    });
  });

  it('returns session unchanged when user not found in database', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const { authOptions } = await import('../auth');
    const sessionCallback = authOptions.callbacks!.session as unknown as (
      params: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
    const session = { user: { name: 'Test' }, expires: 'some-date' };
    const result = await sessionCallback({ session, token: { sub: 'nonexistent' } });
    expect((result as any).user?.id).toBeUndefined();
  });

  it('returns session unchanged when token has no sub', async () => {
    const { authOptions } = await import('../auth');
    const sessionCallback = authOptions.callbacks!.session as unknown as (
      params: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
    const session = { user: { name: 'Test' }, expires: 'some-date' };
    const result = await sessionCallback({ session, token: {} });
    expect((result as any).user?.id).toBeUndefined();
  });

  describe('signIn callback', () => {
    it('allows sign in for dev-credentials provider', async () => {
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({ account: { provider: 'dev-credentials' } });
      expect(result).toBe(true);
    });

    it('allows sign in for google provider with existing user', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'existing@example.com',
      } as any);
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'google' },
        profile: { email: 'existing@example.com', name: 'Existing' },
      });
      expect(result).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'existing@example.com' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates user for google sign in with new email', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user',
        email: 'new@example.com',
      } as any);
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'google' },
        profile: { email: 'new@example.com', name: 'New User' },
      });
      expect(result).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          name: 'New User',
          role: 'ADMIN_ADULT',
        },
      });
    });

    it('creates user with email as name when profile name is missing', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'u1',
        email: 'anon@example.com',
      } as any);
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      await signInCallback({
        account: { provider: 'google' },
        profile: { email: 'anon@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'anon@example.com',
          name: 'anon@example.com',
          role: 'ADMIN_ADULT',
        },
      });
    });

    it('rejects sign in for unknown provider', async () => {
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'github' },
        profile: { email: 'test@example.com' },
      });
      expect(result).toBe(false);
    });

    it('rejects google sign in without profile email', async () => {
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'google' },
        profile: {},
      });
      expect(result).toBe(false);
    });
  });
});

describe('dev credentials provider', () => {
  it('is included when DEV_AUTH_ENABLED is true', async () => {
    vi.stubEnv('DEV_AUTH_ENABLED', 'true');
    vi.stubEnv('DEV_AUTH_USERNAME', 'admin');
    vi.stubEnv('DEV_AUTH_PASSWORD', 'pass');
    const { authOptions } = await import('../auth');
    const devProvider = authOptions.providers.find((p) => p.id === 'dev-credentials');
    expect(devProvider).toBeDefined();
  });

  it('is not included when DEV_AUTH_ENABLED is false', async () => {
    vi.stubEnv('DEV_AUTH_ENABLED', 'false');
    const { authOptions } = await import('../auth');
    const devProvider = authOptions.providers.find((p) => p.id === 'dev-credentials');
    expect(devProvider).toBeUndefined();
  });

  it('is not included when DEV_AUTH_ENABLED is not set', async () => {
    vi.stubEnv('DEV_AUTH_ENABLED', '');
    const { authOptions } = await import('../auth');
    const devProvider = authOptions.providers.find((p) => p.id === 'dev-credentials');
    expect(devProvider).toBeUndefined();
  });
});
