import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn((config: Record<string, unknown>) => ({
    id: 'google',
    name: 'Google',
    ...config,
  })),
}));

vi.mock('next-auth/providers/apple', () => ({
  default: vi.fn((config: Record<string, unknown>) => ({
    id: 'apple',
    name: 'Apple',
    options: { ...config },
    ...config,
  })),
}));

vi.mock('next-auth/providers/facebook', () => ({
  default: vi.fn((config: Record<string, unknown>) => ({
    id: 'facebook',
    name: 'Facebook',
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
    linkedIdentity: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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

  it('configures Apple provider when Apple env vars are present', async () => {
    vi.stubEnv('AUTH_APPLE_TEAM_ID', 'APPLE_TEAM_1');
    vi.stubEnv('AUTH_APPLE_ID', 'com.foliapicnic.auth');
    vi.stubEnv('AUTH_APPLE_KEY_ID', 'KEY_1');
    vi.stubEnv(
      'AUTH_APPLE_PRIVATE_KEY',
      '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----',
    );
    const { authOptions } = await import('../auth');
    const apple = authOptions.providers.find((p) => p.id === 'apple') as any;
    expect(apple).toBeDefined();
    expect(apple.id).toBe('apple');
    expect(apple.clientId).toBe('com.foliapicnic.auth');
    expect(typeof apple.clientSecret).toBe('string');
    expect(typeof apple.options.clientSecret).toBe('string');
  });

  it('has signIn page set to /login', async () => {
    const { authOptions } = await import('../auth');
    expect(authOptions.pages?.signIn).toBe('/login');
  });

  it('has session, jwt, and signIn callbacks defined', async () => {
    const { authOptions } = await import('../auth');
    expect(typeof authOptions.callbacks?.session).toBe('function');
    expect(typeof authOptions.callbacks?.jwt).toBe('function');
    expect(typeof authOptions.callbacks?.signIn).toBe('function');
  });
});

describe('authOptions jwt callback', () => {
  it('resolves google OAuth login to internal user id even when token.sub has provider sub', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
      id: 'ident-123',
      userId: 'user-cuid-999',
      provider: 'google',
      providerAccountId: 'google-sub-12345',
      user: {
        id: 'user-cuid-999',
        email: 'user@gmail.com',
        name: 'Google User',
        role: 'SUPER_ADMIN',
        deletedAt: null,
      },
    } as any);

    const { authOptions } = await import('../auth');
    const jwtCallback = authOptions.callbacks!.jwt as unknown as (
      params: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;

    // NextAuth pre-populates token.sub with the provider user id on initial OAuth callback
    const initialToken = {
      name: 'Google User',
      email: 'user@gmail.com',
      sub: 'google-sub-12345',
    };
    const account = { provider: 'google', providerAccountId: 'google-sub-12345' };
    const profile = { sub: 'google-sub-12345', email: 'user@gmail.com', name: 'Google User' };

    const result = await jwtCallback({
      token: initialToken,
      account,
      profile,
      user: { id: 'google-sub-12345' },
    });

    expect(result.sub).toBe('user-cuid-999');
  });

  it('maps dev-credentials login user.id directly to token.sub', async () => {
    const { authOptions } = await import('../auth');
    const jwtCallback = authOptions.callbacks!.jwt as unknown as (
      params: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;

    const result = await jwtCallback({
      token: {},
      account: { provider: 'dev-credentials' },
      user: { id: 'dev-user-123' },
    });

    expect(result.sub).toBe('dev-user-123');
  });

  it('preserves existing token.sub on subsequent token reads (when account is undefined)', async () => {
    const { authOptions } = await import('../auth');
    const jwtCallback = authOptions.callbacks!.jwt as unknown as (
      params: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;

    const result = await jwtCallback({
      token: { sub: 'user-cuid-999', name: 'Existing User' },
    });

    expect(result.sub).toBe('user-cuid-999');
  });
});

describe('authOptions session callback', () => {
  it('enriches session user with id, role, and householdId from database', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-42',
      role: 'SUPER_ADMIN',
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
    expect(user.role).toBe('SUPER_ADMIN');
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

    it('refuses sign in for unknown providers', async () => {
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

    it('allows sign in for google OAuth when profile has a sub and email', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
        id: 'ident-1',
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-sub-1',
        user: {
          id: 'user-1',
          email: 'existing@example.com',
          name: 'Existing',
          role: 'ADMIN_ADULT',
          deletedAt: null,
        },
      } as any);
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'google' },
        profile: { sub: 'google-sub-1', email: 'existing@example.com', name: 'Existing' },
      });
      expect(result).toBe(true);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('allows sign in for apple OAuth by creating a new user when missing', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'new-user',
              email: 'apple@example.com',
              name: 'apple@example.com',
              role: 'ADMIN_ADULT',
            }),
          },
          linkedIdentity: {
            create: vi.fn().mockResolvedValue({
              id: 'ident-1',
              userId: 'new-user',
              provider: 'apple',
              providerAccountId: 'apple-sub-1',
              emailSnapshot: 'apple@example.com',
            }),
          },
        } as any);
      });
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'apple' },
        profile: {
          sub: 'apple-sub-1',
          email: 'apple@example.com',
          name: 'Apple User',
        },
      });
      expect(result).toBe(true);
    });

    it('allows sign in for facebook OAuth by linking to an existing user by email', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        email: 'existing@example.com',
        name: 'Existing',
        role: 'ADMIN_ADULT',
        deletedAt: null,
      } as any);
      vi.mocked(prisma.linkedIdentity.create).mockResolvedValue({
        id: 'ident-1',
        userId: 'user-1',
        provider: 'facebook',
        providerAccountId: 'facebook-id-1',
        emailSnapshot: 'existing@example.com',
      } as any);
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'facebook' },
        profile: { id: 'facebook-id-1', email: 'existing@example.com', name: 'Existing' },
      });
      expect(result).toBe(true);
      expect(prisma.linkedIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          provider: 'facebook',
          providerAccountId: 'facebook-id-1',
          emailSnapshot: 'existing@example.com',
        },
      });
    });

    it('refuses sign in when apple provider returns no sub', async () => {
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'apple' },
        profile: { email: 'test@example.com' },
      });
      expect(result).toBe(false);
    });

    it('refuses sign in when facebook provider returns no id', async () => {
      const { authOptions } = await import('../auth');
      const signInCallback = authOptions.callbacks!.signIn as unknown as (
        params: Record<string, unknown>,
      ) => Promise<boolean>;
      const result = await signInCallback({
        account: { provider: 'facebook' },
        profile: { email: 'test@example.com' },
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

  describe('authorize function', () => {
    async function getDevProvider() {
      vi.stubEnv('DEV_AUTH_ENABLED', 'true');
      const { authOptions } = await import('../auth');
      const devProvider = authOptions.providers.find((p) => p.id === 'dev-credentials') as
        { authorize: (creds: Record<string, unknown>) => Promise<unknown> } | undefined;
      if (!devProvider) throw new Error('dev provider missing');
      return devProvider;
    }

    it('returns null when DEV_AUTH_ENABLED is not true at authorize time', async () => {
      vi.stubEnv('DEV_AUTH_ENABLED', 'true');
      const { authOptions } = await import('../auth');
      const devProvider = authOptions.providers.find((p) => p.id === 'dev-credentials') as
        { authorize: (creds: Record<string, unknown>) => Promise<unknown> } | undefined;
      vi.stubEnv('DEV_AUTH_ENABLED', 'false');
      const result = await devProvider!.authorize({ username: 'admin', password: 'pass' });
      expect(result).toBeNull();
    });

    it('returns null when credentials are missing', async () => {
      const devProvider = await getDevProvider();
      expect(await devProvider.authorize({})).toBeNull();
      expect(await devProvider.authorize({ username: 'u' })).toBeNull();
      expect(await devProvider.authorize({ password: 'p' })).toBeNull();
    });

    it('signs in as ADMIN when username/password match dev credentials', async () => {
      vi.stubEnv('DEV_AUTH_USERNAME', 'admin');
      vi.stubEnv('DEV_AUTH_PASSWORD', 'pass');
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        email: 'dev-admin@family-picnic.local',
        name: 'admin',
      } as never);
      const devProvider = await getDevProvider();
      const result = await devProvider.authorize({ username: 'admin', password: 'pass' });
      expect(result).toEqual({
        id: 'u-1',
        email: 'dev-admin@family-picnic.local',
        name: 'admin',
      });
    });

    it('creates dev-admin user on first sign-in if not in database', async () => {
      vi.stubEnv('DEV_AUTH_USERNAME', 'admin');
      vi.stubEnv('DEV_AUTH_PASSWORD', 'pass');
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'u-new',
        email: 'dev-admin@family-picnic.local',
        name: 'admin',
      } as never);
      const devProvider = await getDevProvider();
      const result = await devProvider.authorize({ username: 'admin', password: 'pass' });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'dev-admin@family-picnic.local', name: 'admin', role: 'SUPER_ADMIN' },
      });
      expect(result).toEqual({
        id: 'u-new',
        email: 'dev-admin@family-picnic.local',
        name: 'admin',
      });
    });

    it('falls through to prisma lookup when dev creds do not match', async () => {
      vi.stubEnv('DEV_AUTH_USERNAME', 'admin');
      vi.stubEnv('DEV_AUTH_PASSWORD', 'pass');
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'u-2',
        email: 'member@example.com',
        name: 'Member',
      } as never);
      const devProvider = await getDevProvider();
      const result = await devProvider.authorize({
        username: 'member@example.com',
        password: 'pwd',
      });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'member@example.com', devPassword: 'pwd', deletedAt: null },
      });
      expect(result).toEqual({
        id: 'u-2',
        email: 'member@example.com',
        name: 'Member',
      });
    });

    it('returns null when no user matches prisma lookup', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      const devProvider = await getDevProvider();
      const result = await devProvider.authorize({
        username: 'nobody@example.com',
        password: 'wrong',
      });
      expect(result).toBeNull();
    });

    it('returns null when dev creds are not configured (env empty) and lookup fails', async () => {
      delete process.env.DEV_AUTH_USERNAME;
      delete process.env.DEV_AUTH_PASSWORD;
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      const devProvider = await getDevProvider();
      const result = await devProvider.authorize({
        username: 'u@example.com',
        password: 'p',
      });
      expect(result).toBeNull();
    });
  });
});

describe('getEnabledOAuthProviders', () => {
  it('returns apple when Apple credentials are fully configured', async () => {
    vi.stubEnv('AUTH_APPLE_TEAM_ID', 'APPLE_TEAM_1');
    vi.stubEnv('AUTH_APPLE_ID', 'com.foliapicnic.auth');
    vi.stubEnv('AUTH_APPLE_KEY_ID', 'KEY_1');
    vi.stubEnv(
      'AUTH_APPLE_PRIVATE_KEY',
      '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----',
    );
    const { getEnabledOAuthProviders } = await import('../auth');
    expect(getEnabledOAuthProviders()).toContain('apple');
  });

  it('excludes apple when Apple credentials are missing', async () => {
    delete process.env.AUTH_APPLE_TEAM_ID;
    delete process.env.AUTH_APPLE_ID;
    delete process.env.AUTH_APPLE_KEY_ID;
    delete process.env.AUTH_APPLE_PRIVATE_KEY;
    const { getEnabledOAuthProviders } = await import('../auth');
    expect(getEnabledOAuthProviders()).not.toContain('apple');
  });
});
