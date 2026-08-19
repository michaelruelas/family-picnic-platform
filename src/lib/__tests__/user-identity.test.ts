import { describe, it, expect, vi, beforeEach } from 'vitest';

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
});

describe('isOAuthProvider', () => {
  it('accepts google, apple, and facebook', async () => {
    const { isOAuthProvider } = await import('../user-identity');
    expect(isOAuthProvider('google')).toBe(true);
    expect(isOAuthProvider('apple')).toBe(true);
    expect(isOAuthProvider('facebook')).toBe(true);
  });

  it('rejects unknown providers and empty strings', async () => {
    const { isOAuthProvider } = await import('../user-identity');
    expect(isOAuthProvider('github')).toBe(false);
    expect(isOAuthProvider('linkedin')).toBe(false);
    expect(isOAuthProvider('')).toBe(false);
  });
});

describe('findOrCreateUserByIdentity', () => {
  it('throws when providerAccountId is empty', async () => {
    const { findOrCreateUserByIdentity } = await import('../user-identity');
    await expect(
      findOrCreateUserByIdentity({
        provider: 'google',
        providerAccountId: '   ',
        emailSnapshot: 'a@example.com',
      }),
    ).rejects.toThrow('providerAccountId is required');
  });

  describe('branch 1: existing LinkedIdentity', () => {
    it('returns the owning user and writes a success audit', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
        id: 'ident-1',
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-sub-1',
        emailSnapshot: 'a@example.com',
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'a@example.com',
          name: 'A',
          role: 'ADMIN',
          deletedAt: null,
        },
      } as never);

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      const result = await findOrCreateUserByIdentity({
        provider: 'google',
        providerAccountId: 'google-sub-1',
        emailSnapshot: 'a@example.com',
      });

      expect(result?.userId).toBe('user-1');
      expect(result?.identityCreated).toBe(false);
      expect(result?.linkedToExistingUser).toBe(false);
      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'auth.signIn.succeeded',
        }),
      });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses and audits when the owning user is soft-deleted', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
        id: 'ident-1',
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-sub-1',
        emailSnapshot: 'a@example.com',
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'a@example.com',
          name: 'A',
          role: 'ADMIN',
          deletedAt: new Date(),
        },
      } as never);

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      const result = await findOrCreateUserByIdentity({
        provider: 'google',
        providerAccountId: 'google-sub-1',
        emailSnapshot: 'a@example.com',
      });

      expect(result).toBeNull();
      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'auth.signIn.refused',
          newValue: expect.objectContaining({ reason: 'user_tombstoned' }),
        }),
      });
    });
  });

  describe('branch 1.5: missing email from provider', () => {
    it('refuses sign-in and audits email_missing when no LinkedIdentity and no email', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      const result = await findOrCreateUserByIdentity({
        provider: 'apple',
        providerAccountId: 'apple-sub-1',
        emailSnapshot: null,
      });

      expect(result).toBeNull();
      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'unknown',
          action: 'auth.signIn.refused',
          newValue: expect.objectContaining({ reason: 'email_missing' }),
        }),
      });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('branch 2: active user by email', () => {
    it('links a new LinkedIdentity to the existing user and audits matchedBy=email', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'user-1',
        email: 'existing@example.com',
        name: 'Existing',
        role: 'ADMIN',
        deletedAt: null,
      } as never);
      vi.mocked(prisma.linkedIdentity.create).mockResolvedValue({
        id: 'ident-2',
        userId: 'user-1',
        provider: 'facebook',
        providerAccountId: 'facebook-id-1',
        emailSnapshot: 'existing@example.com',
        createdAt: new Date(),
      } as never);

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      const result = await findOrCreateUserByIdentity({
        provider: 'facebook',
        providerAccountId: 'facebook-id-1',
        emailSnapshot: 'existing@example.com',
      });

      expect(result?.userId).toBe('user-1');
      expect(result?.identityCreated).toBe(true);
      expect(result?.linkedToExistingUser).toBe(true);
      expect(prisma.linkedIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          provider: 'facebook',
          providerAccountId: 'facebook-id-1',
          emailSnapshot: 'existing@example.com',
        },
      });
      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'auth.identity.linked',
          newValue: expect.objectContaining({ matchedBy: 'email' }),
        }),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('branch 3: tombstoned user by email', () => {
    it('refuses and audits email_tombstoned', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'user-tomb',
        deletedAt: new Date(),
      } as never);

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      const result = await findOrCreateUserByIdentity({
        provider: 'apple',
        providerAccountId: 'apple-sub-2',
        emailSnapshot: 'gone@example.com',
      });

      expect(result).toBeNull();
      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-tomb',
          action: 'auth.signIn.refused',
          newValue: expect.objectContaining({ reason: 'email_tombstoned' }),
        }),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('branch 4: new user', () => {
    it('creates user + LinkedIdentity in a transaction and audits userCreated=true', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-new',
              email: 'new@example.com',
              name: 'Apple User',
              role: 'ADULT',
            }),
          },
          linkedIdentity: {
            create: vi.fn().mockResolvedValue({
              id: 'ident-new',
              userId: 'user-new',
              provider: 'apple',
              providerAccountId: 'apple-sub-3',
              emailSnapshot: 'new@example.com',
            }),
          },
        } as never);
      });

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      const result = await findOrCreateUserByIdentity({
        provider: 'apple',
        providerAccountId: 'apple-sub-3',
        emailSnapshot: 'new@example.com',
        displayName: 'Apple User',
      });

      expect(result?.userId).toBe('user-new');
      expect(result?.user.role).toBe('ADULT');
      expect(result?.identityCreated).toBe(true);
      expect(result?.linkedToExistingUser).toBe(false);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-new',
          action: 'auth.signIn.succeeded',
          newValue: expect.objectContaining({ userCreated: true }),
        }),
      });
    });

    it('uses the OAuth display name on the new User (no email-as-name)', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      const createUser = vi.fn().mockResolvedValue({
        id: 'user-new',
        email: 'maria@example.com',
        name: 'Maria Garcia',
        role: 'ADULT',
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          user: { create: createUser },
          linkedIdentity: {
            create: vi.fn().mockResolvedValue({
              id: 'ident-new',
              userId: 'user-new',
              provider: 'google',
              providerAccountId: 'g-1',
              emailSnapshot: 'maria@example.com',
            }),
          },
        } as never);
      });

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      await findOrCreateUserByIdentity({
        provider: 'google',
        providerAccountId: 'g-1',
        emailSnapshot: 'maria@example.com',
        displayName: 'Maria Garcia',
      });

      expect(createUser).toHaveBeenCalledWith({
        data: {
          email: 'maria@example.com',
          name: 'Maria Garcia',
          role: 'ADULT',
        },
      });
    });

    it('falls back to email when displayName is missing (Apple subsequent sign-ins)', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      const createUser = vi.fn().mockResolvedValue({
        id: 'user-new',
        email: 'returning@example.com',
        name: 'returning@example.com',
        role: 'ADULT',
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          user: { create: createUser },
          linkedIdentity: {
            create: vi.fn().mockResolvedValue({
              id: 'ident-new',
              userId: 'user-new',
              provider: 'apple',
              providerAccountId: 'apple-sub-4',
              emailSnapshot: 'returning@example.com',
            }),
          },
        } as never);
      });

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      await findOrCreateUserByIdentity({
        provider: 'apple',
        providerAccountId: 'apple-sub-4',
        emailSnapshot: 'returning@example.com',
        displayName: null,
      });

      expect(createUser).toHaveBeenCalledWith({
        data: {
          email: 'returning@example.com',
          name: 'returning@example.com',
          role: 'ADULT',
        },
      });
    });

    it('trims and caps an oversized display name to 200 characters', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      const createUser = vi.fn().mockResolvedValue({
        id: 'user-new',
        email: 'long@example.com',
        name: 'x'.repeat(200),
        role: 'ADULT',
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          user: { create: createUser },
          linkedIdentity: {
            create: vi.fn().mockResolvedValue({
              id: 'ident-new',
              userId: 'user-new',
              provider: 'google',
              providerAccountId: 'g-2',
              emailSnapshot: 'long@example.com',
            }),
          },
        } as never);
      });

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      await findOrCreateUserByIdentity({
        provider: 'google',
        providerAccountId: 'g-2',
        emailSnapshot: 'long@example.com',
        displayName: '   ' + 'x'.repeat(500) + '   ',
      });

      const call = createUser.mock.calls[0]?.[0] as { data: { name: string } };
      expect(call.data.name).toHaveLength(200);
      expect(call.data.name).toBe('x'.repeat(200));
    });

    it('normalizes the email (trim + lowercase) before lookup', async () => {
      const { prisma } = await import('~/lib/prisma');
      vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-new',
              email: 'mixed@example.com',
              name: 'mixed@example.com',
              role: 'ADULT',
            }),
          },
          linkedIdentity: {
            create: vi.fn().mockResolvedValue({
              id: 'ident-new',
              userId: 'user-new',
              provider: 'google',
              providerAccountId: 'g-1',
              emailSnapshot: 'mixed@example.com',
            }),
          },
        } as never);
      });

      const { findOrCreateUserByIdentity } = await import('../user-identity');
      await findOrCreateUserByIdentity({
        provider: 'google',
        providerAccountId: 'g-1',
        emailSnapshot: '  Mixed@Example.COM  ',
      });

      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { email: { equals: 'mixed@example.com', mode: 'insensitive' }, deletedAt: null },
      });
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, {
        where: { email: { equals: 'mixed@example.com', mode: 'insensitive' } },
        select: { id: true, deletedAt: true },
      });
    });
  });
});

describe('linkIdentityToCurrentUser', () => {
  it('throws when providerAccountId is empty', async () => {
    const { linkIdentityToCurrentUser } = await import('../user-identity');
    await expect(
      linkIdentityToCurrentUser('user-1', {
        provider: 'apple',
        providerAccountId: '',
      }),
    ).rejects.toThrow('providerAccountId is required');
  });

  it('returns the existing identity when already linked to the same user', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
      id: 'ident-1',
      userId: 'user-1',
      provider: 'apple',
      providerAccountId: 'apple-sub-1',
      emailSnapshot: 'a@example.com',
      createdAt: new Date(),
    } as never);

    const { linkIdentityToCurrentUser } = await import('../user-identity');
    const result = await linkIdentityToCurrentUser('user-1', {
      provider: 'apple',
      providerAccountId: 'apple-sub-1',
    });

    expect(result).toEqual({ id: 'ident-1', provider: 'apple' });
    expect(prisma.linkedIdentity.create).not.toHaveBeenCalled();
  });

  it('throws IdentityAlreadyLinkedError when the identity belongs to a different user', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
      id: 'ident-1',
      userId: 'user-other',
      provider: 'apple',
      providerAccountId: 'apple-sub-1',
      emailSnapshot: 'other@example.com',
      createdAt: new Date(),
    } as never);

    const { linkIdentityToCurrentUser, IdentityAlreadyLinkedError } =
      await import('../user-identity');
    await expect(
      linkIdentityToCurrentUser('user-1', {
        provider: 'apple',
        providerAccountId: 'apple-sub-1',
      }),
    ).rejects.toBeInstanceOf(IdentityAlreadyLinkedError);
  });

  it('creates a new identity when none exists and audits matchedBy=explicit', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      deletedAt: null,
    } as never);
    vi.mocked(prisma.linkedIdentity.create).mockResolvedValue({
      id: 'ident-2',
      userId: 'user-1',
      provider: 'apple',
      providerAccountId: 'apple-sub-2',
      emailSnapshot: 'a@example.com',
      createdAt: new Date(),
    } as never);

    const { linkIdentityToCurrentUser } = await import('../user-identity');
    const result = await linkIdentityToCurrentUser('user-1', {
      provider: 'apple',
      providerAccountId: 'apple-sub-2',
    });

    expect(result).toEqual({ id: 'ident-2', provider: 'apple' });
    expect(prisma.linkedIdentity.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        provider: 'apple',
        providerAccountId: 'apple-sub-2',
        emailSnapshot: 'a@example.com',
      },
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'auth.identity.linked',
        newValue: expect.objectContaining({ matchedBy: 'explicit' }),
      }),
    });
  });

  it('throws when the user is missing or soft-deleted', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue(null);
    // linkIdentityToCurrentUser resolves the target by id via findUnique,
    // so only that mock needs to return null here.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const { linkIdentityToCurrentUser } = await import('../user-identity');
    await expect(
      linkIdentityToCurrentUser('user-1', {
        provider: 'apple',
        providerAccountId: 'apple-sub-3',
      }),
    ).rejects.toThrow('User not found');
  });
});

describe('listLinkedIdentities', () => {
  it('returns the identities for the user ordered by createdAt', async () => {
    const { prisma } = await import('~/lib/prisma');
    const rows = [
      {
        id: 'ident-1',
        provider: 'google',
        providerAccountId: 'g-1',
        emailSnapshot: 'a@example.com',
        createdAt: new Date('2026-01-01'),
      },
    ];
    vi.mocked(prisma.linkedIdentity.findMany).mockResolvedValue(rows as never);

    const { listLinkedIdentities } = await import('../user-identity');
    const result = await listLinkedIdentities('user-1');

    expect(result).toEqual(rows);
    expect(prisma.linkedIdentity.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        emailSnapshot: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  });
});

describe('unlinkIdentity', () => {
  it('refuses to unlink an identity that does not belong to the user', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
      id: 'ident-1',
      userId: 'user-other',
      provider: 'apple',
      providerAccountId: 'apple-sub-1',
      emailSnapshot: 'other@example.com',
      createdAt: new Date(),
    } as never);

    const { unlinkIdentity } = await import('../user-identity');
    await expect(unlinkIdentity('user-1', 'ident-1')).rejects.toThrow('Identity not found');
    expect(prisma.linkedIdentity.delete).not.toHaveBeenCalled();
  });

  it('deletes the identity and writes an unlink audit', async () => {
    const { prisma } = await import('~/lib/prisma');
    vi.mocked(prisma.linkedIdentity.findUnique).mockResolvedValue({
      id: 'ident-1',
      userId: 'user-1',
      provider: 'apple',
      providerAccountId: 'apple-sub-1',
      emailSnapshot: 'a@example.com',
      createdAt: new Date(),
    } as never);

    const { unlinkIdentity } = await import('../user-identity');
    await unlinkIdentity('user-1', 'ident-1');

    expect(prisma.linkedIdentity.delete).toHaveBeenCalledWith({ where: { id: 'ident-1' } });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        action: 'auth.identity.unlinked',
        oldValue: expect.objectContaining({ provider: 'apple', identityId: 'ident-1' }),
      }),
    });
  });
});
