import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('~/lib/prisma', () => ({
  prisma: {
    communicationLog: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

const { prisma } = await import('~/lib/prisma');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rateLimitError', () => {
  it('throws TRPCError with TOO_MANY_REQUESTS code', async () => {
    const { rateLimitError } = await import('../rate-limit');
    const resetAt = new Date('2025-06-01T12:00:00Z');
    try {
      rateLimitError({ allowed: false, remaining: 0, resetAt, retryAfterMs: 5000 }, 'broadcast');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('TOO_MANY_REQUESTS');
    }
  });

  it('includes type and retryAfterMs in cause', async () => {
    const { rateLimitError } = await import('../rate-limit');
    const resetAt = new Date('2025-06-01T12:00:00Z');
    try {
      rateLimitError({ allowed: false, remaining: 1, resetAt, retryAfterMs: 10000 }, 'recipient');
      expect.unreachable('should have thrown');
    } catch (error) {
      const trpcError = error as TRPCError;
      expect(trpcError.cause).toMatchObject({
        type: 'recipient',
        remaining: 1,
        retryAfterMs: 10000,
      });
      expect(trpcError.message).toContain('recipient');
    }
  });

  it('includes resetAt ISO string in cause', async () => {
    const { rateLimitError } = await import('../rate-limit');
    const resetAt = new Date('2025-06-01T12:00:00Z');
    try {
      rateLimitError({ allowed: false, remaining: 2, resetAt, retryAfterMs: 30000 }, 'test-type');
      expect.unreachable('should have thrown');
    } catch (error) {
      const cause = (error as TRPCError).cause as unknown as Record<string, unknown>;
      expect(cause.resetAt).toBe('2025-06-01T12:00:00.000Z');
    }
  });
});

describe('checkAdminBroadcastRateLimit', () => {
  it('returns allowed when count is below limit', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(3);
    const { checkAdminBroadcastRateLimit } = await import('../rate-limit');
    const result = await checkAdminBroadcastRateLimit('admin-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetAt).toBeInstanceOf(Date);
    expect(result.retryAfterMs).toBeUndefined();
    expect(prisma.communicationLog.count).toHaveBeenCalledWith({
      where: {
        sentByUserId: 'admin-1',
        attemptedAt: { gte: expect.any(Date) },
        status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
      },
    });
  });

  it('returns blocked when count is at limit', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(5);
    const { checkAdminBroadcastRateLimit } = await import('../rate-limit');
    const result = await checkAdminBroadcastRateLimit('admin-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBe(60 * 60 * 1000);
  });

  it('returns blocked when count exceeds limit', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(7);
    const { checkAdminBroadcastRateLimit } = await import('../rate-limit');
    const result = await checkAdminBroadcastRateLimit('admin-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('checkRecipientGroupRateLimit', () => {
  it('returns allowed when count is below limit', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(0);
    const { checkRecipientGroupRateLimit } = await import('../rate-limit');
    const result = await checkRecipientGroupRateLimit('admin-1', 'event-1', 'ALL');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('returns blocked when count is at limit', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(1);
    const { checkRecipientGroupRateLimit } = await import('../rate-limit');
    const result = await checkRecipientGroupRateLimit('admin-1', 'event-1', 'ALL');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBe(30 * 60 * 1000);
  });

  it('passes eventId and sentByUserId in query', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(0);
    const { checkRecipientGroupRateLimit } = await import('../rate-limit');
    await checkRecipientGroupRateLimit('admin-2', 'event-5', 'HOUSEHOLD', ['house-1', 'house-2']);
    expect(prisma.communicationLog.count).toHaveBeenCalledWith({
      where: {
        sentByUserId: 'admin-2',
        eventId: 'event-5',
        attemptedAt: { gte: expect.any(Date) },
        status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
      },
    });
  });
});

describe('checkRecipientRateLimit', () => {
  it('returns allowed when count is below limit', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(1);
    const { checkRecipientRateLimit } = await import('../rate-limit');
    const result = await checkRecipientRateLimit('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('returns blocked when count is at limit', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(2);
    const { checkRecipientRateLimit } = await import('../rate-limit');
    const result = await checkRecipientRateLimit('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBe(24 * 60 * 60 * 1000);
  });

  it('queries by recipientUserId', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(0);
    const { checkRecipientRateLimit } = await import('../rate-limit');
    await checkRecipientRateLimit('recipient-42');
    expect(prisma.communicationLog.count).toHaveBeenCalledWith({
      where: {
        recipientUserId: 'recipient-42',
        attemptedAt: { gte: expect.any(Date) },
        status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
      },
    });
  });
});

describe('checkAllRecipientRateLimits', () => {
  it('returns correct results per userId', async () => {
    vi.mocked(prisma.communicationLog.groupBy).mockResolvedValue([
      { recipientUserId: 'user-1', _count: 0 } as any,
      { recipientUserId: 'user-2', _count: 1 } as any,
    ]);
    const { checkAllRecipientRateLimits } = await import('../rate-limit');
    const results = await checkAllRecipientRateLimits(['user-1', 'user-2', 'user-3']);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ userId: 'user-1', allowed: true, remaining: 2 });
    expect(results[1]).toEqual({ userId: 'user-2', allowed: true, remaining: 1 });
    expect(results[2]).toEqual({ userId: 'user-3', allowed: true, remaining: 2 });
  });

  it('filters recipients at limit correctly', async () => {
    vi.mocked(prisma.communicationLog.groupBy).mockResolvedValue([
      { recipientUserId: 'u1', _count: 2 } as any,
      { recipientUserId: 'u2', _count: 0 } as any,
      { recipientUserId: 'u3', _count: 50 } as any,
    ]);
    const { checkAllRecipientRateLimits } = await import('../rate-limit');
    const results = await checkAllRecipientRateLimits(['u1', 'u2', 'u3']);
    expect(results[0]!.allowed).toBe(false);
    expect(results[1]!.allowed).toBe(true);
    expect(results[2]!.allowed).toBe(false);
  });

  it('passes correct where clause to groupBy', async () => {
    vi.mocked(prisma.communicationLog.groupBy).mockResolvedValue([]);
    const { checkAllRecipientRateLimits } = await import('../rate-limit');
    await checkAllRecipientRateLimits(['a', 'b']);
    expect(prisma.communicationLog.groupBy).toHaveBeenCalledWith({
      by: ['recipientUserId'],
      where: {
        recipientUserId: { in: ['a', 'b'] },
        attemptedAt: { gte: expect.any(Date) },
        status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
      },
      _count: true,
    });
  });
});

describe('getRateLimitStatus', () => {
  it('returns structured status with broadcasts, recipientGroup, recipient', async () => {
    vi.mocked(prisma.communicationLog.count).mockResolvedValue(1);
    const { getRateLimitStatus } = await import('../rate-limit');
    const status = await getRateLimitStatus('admin-1');
    expect(status).toHaveProperty('broadcasts');
    expect(status).toHaveProperty('recipientGroup');
    expect(status).toHaveProperty('recipient');
    expect(status.broadcasts).toMatchObject({
      remaining: 4,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    expect(status.broadcasts.resetAt).toBeInstanceOf(Date);
    expect(status.recipientGroup).toMatchObject({
      remaining: 0,
      limit: 1,
      windowMs: 30 * 60 * 1000,
    });
    expect(status.recipient).toMatchObject({
      limit: 2,
      windowMs: 24 * 60 * 60 * 1000,
    });
    expect(prisma.communicationLog.count).toHaveBeenCalledTimes(2);
  });
});
