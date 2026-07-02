import { prisma } from '~/lib/prisma';
import { TRPCError } from '@trpc/server';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

const BROADCASTS_PER_HOUR = 5;
const BROADCAST_WINDOW_MS = 60 * 60 * 1000;
const RECIPIENT_GROUP_PER_30_MIN = 1;
const RECIPIENT_GROUP_WINDOW_MS = 30 * 60 * 1000;
const RECIPIENTS_PER_DAY = 2;
const RECIPIENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function checkAdminBroadcastRateLimit(
  adminUserId: string,
): Promise<RateLimitResult> {
  const oneHourAgo = new Date(Date.now() - BROADCAST_WINDOW_MS);

  const recentBroadcasts = await prisma.communicationLog.count({
    where: {
      sentByUserId: adminUserId,
      attemptedAt: { gte: oneHourAgo },
      status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
    },
  });

  const remaining = Math.max(0, BROADCASTS_PER_HOUR - recentBroadcasts);
  const resetAt = new Date(oneHourAgo.getTime() + BROADCAST_WINDOW_MS);

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterMs: BROADCAST_WINDOW_MS,
    };
  }

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

export async function checkRecipientGroupRateLimit(
  adminUserId: string,
  eventId: string,
  _recipientType: string,
  _recipientIds?: string[],
): Promise<RateLimitResult> {
  const thirtyMinutesAgo = new Date(Date.now() - RECIPIENT_GROUP_WINDOW_MS);

  const recentGroupBroadcasts = await prisma.communicationLog.count({
    where: {
      sentByUserId: adminUserId,
      eventId,
      attemptedAt: { gte: thirtyMinutesAgo },
      status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
    },
  });

  const remaining = Math.max(0, RECIPIENT_GROUP_PER_30_MIN - recentGroupBroadcasts);
  const resetAt = new Date(thirtyMinutesAgo.getTime() + RECIPIENT_GROUP_WINDOW_MS);

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterMs: RECIPIENT_GROUP_WINDOW_MS,
    };
  }

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

export async function checkRecipientRateLimit(
  recipientUserId: string,
): Promise<RateLimitResult> {
  const oneDayAgo = new Date(Date.now() - RECIPIENT_WINDOW_MS);

  const recentMessages = await prisma.communicationLog.count({
    where: {
      recipientUserId,
      attemptedAt: { gte: oneDayAgo },
      status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
    },
  });

  const remaining = Math.max(0, RECIPIENTS_PER_DAY - recentMessages);
  const resetAt = new Date(oneDayAgo.getTime() + RECIPIENT_WINDOW_MS);

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterMs: RECIPIENT_WINDOW_MS,
    };
  }

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

export async function checkAllRecipientRateLimits(
  recipientUserIds: string[],
): Promise<{ userId: string; allowed: boolean; remaining: number }[]> {
  const oneDayAgo = new Date(Date.now() - RECIPIENT_WINDOW_MS);

  const recentMessages = await prisma.communicationLog.groupBy({
    by: ['recipientUserId'],
    where: {
      recipientUserId: { in: recipientUserIds },
      attemptedAt: { gte: oneDayAgo },
      status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
    },
    _count: true,
  });

  const messageCounts = new Map(recentMessages.map((m) => [m.recipientUserId, m._count]));

  return recipientUserIds.map((userId) => {
    const count = messageCounts.get(userId) || 0;
    const remaining = Math.max(0, RECIPIENTS_PER_DAY - count);
    return { userId, allowed: remaining > 0, remaining };
  });
}

export async function getRateLimitStatus(adminUserId: string) {
  const [broadcastStatus, recipientGroupStatus] = await Promise.all([
    checkAdminBroadcastRateLimit(adminUserId),
    checkRecipientGroupRateLimit(adminUserId, '', 'ALL'),
  ]);

  return {
    broadcasts: {
      remaining: broadcastStatus.remaining,
      limit: BROADCASTS_PER_HOUR,
      windowMs: BROADCAST_WINDOW_MS,
      resetAt: broadcastStatus.resetAt,
    },
    recipientGroup: {
      remaining: recipientGroupStatus.remaining,
      limit: RECIPIENT_GROUP_PER_30_MIN,
      windowMs: RECIPIENT_GROUP_WINDOW_MS,
      resetAt: recipientGroupStatus.resetAt,
    },
    recipient: {
      limit: RECIPIENTS_PER_DAY,
      windowMs: RECIPIENT_WINDOW_MS,
    },
  };
}

export function rateLimitError(result: RateLimitResult, type: string): never {
  throw new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: `Rate limit exceeded for ${type}. Please try again later.`,
    cause: {
      type,
      remaining: result.remaining,
      resetAt: result.resetAt.toISOString(),
      retryAfterMs: result.retryAfterMs,
    },
  });
}
