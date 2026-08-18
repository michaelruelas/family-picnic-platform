import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from 'next-auth';
import type { Role } from '~/lib/generated/enums';

vi.mock('~/lib/prisma', () => ({
  prisma: {
    eventAdmin: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '~/lib/prisma';
import { canAccessEvent, requireEventAccess, getEventRole } from '../event-access';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeSession(role: Role | null, userId = 'u-1'): Session {
  if (role === null) {
    return { user: undefined, expires: 'x' } as unknown as Session;
  }
  return {
    user: {
      id: userId,
      name: 'Test',
      email: 't@example.com',
      role,
      householdId: null,
    },
    expires: 'x',
  };
}

describe('FPP-65 / QUB-13.4: canAccessEvent', () => {
  it('rejects unauthenticated callers', async () => {
    expect(await canAccessEvent(null, 'e-1')).toBe(false);
    expect(await canAccessEvent({ user: undefined } as unknown as Session, 'e-1')).toBe(false);
  });

  it('grants SUPER_ADMIN access to any event without checking EventAdmin', async () => {
    const result = await canAccessEvent(makeSession('SUPER_ADMIN'), 'any-event');
    expect(result).toBe(true);
    // Super-admins must NOT touch the EventAdmin table — the spec
    // says they have global access.
    expect(prisma.eventAdmin.findUnique).not.toHaveBeenCalled();
  });

  it('rejects HOST users with no EventAdmin row for the event', async () => {
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue(null);
    const result = await canAccessEvent(makeSession('HOST'), 'e-1');
    expect(result).toBe(false);
    expect(prisma.eventAdmin.findUnique).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: 'e-1', userId: 'u-1' } },
      select: { id: true },
    });
  });

  it('grants HOST users access when they have an EventAdmin row', async () => {
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue({ id: 'ea-1' } as never);
    const result = await canAccessEvent(makeSession('HOST'), 'e-1');
    expect(result).toBe(true);
  });

  it('grants ADMIN access when they have an EventAdmin row', async () => {
    // ADMIN users can administer events they have an EventAdmin row for.
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue({ id: 'ea-1' } as never);
    const result = await canAccessEvent(makeSession('ADMIN'), 'e-1');
    expect(result).toBe(true);
  });

  it('rejects ADMIN users with no EventAdmin row', async () => {
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue(null);
    expect(await canAccessEvent(makeSession('ADMIN'), 'e-1')).toBe(false);
  });
});

describe('FPP-65 / QUB-13.4: requireEventAccess', () => {
  it('returns 401 for unauthenticated callers', async () => {
    const result = await requireEventAccess(null, 'e-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it('returns 403 when the user cannot access the event', async () => {
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue(null);
    const result = await requireEventAccess(makeSession('HOST'), 'e-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('returns ok for permitted callers', async () => {
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue({ id: 'ea-1' } as never);
    const result = await requireEventAccess(makeSession('HOST'), 'e-1');
    expect(result.ok).toBe(true);
  });
});

describe('FPP-65 / QUB-13.4: getEventRole', () => {
  it('returns SUPER_ADMIN for super-admins without consulting EventAdmin', async () => {
    const result = await getEventRole('u-1', 'e-1', 'SUPER_ADMIN');
    expect(result).toBe('SUPER_ADMIN');
    expect(prisma.eventAdmin.findUnique).not.toHaveBeenCalled();
  });

  it('returns the EventAdmin role for HOST/ADMIN users', async () => {
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue({ role: 'OWNER' } as never);
    const result = await getEventRole('u-1', 'e-1', 'HOST');
    expect(result).toBe('OWNER');
  });

  it('returns null when no EventAdmin row exists', async () => {
    vi.mocked(prisma.eventAdmin.findUnique).mockResolvedValue(null);
    expect(await getEventRole('u-1', 'e-1', 'HOST')).toBe(null);
    expect(await getEventRole('u-1', 'e-1', null)).toBe(null);
  });
});
