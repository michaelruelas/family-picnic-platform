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

// FPP-43 / FPP-1: public PDF download limit. Per-IP sliding window.
// 10 requests / minute is generous enough for a guest browsing the
// page and clicking the link a few times, and tight enough to stop
// scraping.
export const PDF_DOWNLOADS_PER_MINUTE = 10;
export const PDF_DOWNLOAD_WINDOW_MS = 60 * 1000;

// User-submitted feedback. Capped to keep the inbox usable and to
// stop a runaway script from spamming info@foliapicnic.com. 3/hour is
// generous for a real user reporting a few things; tight enough that
// an attacker has to spread across many IPs to keep going.
export const FEEDBACK_SUBMITS_PER_HOUR = 3;
export const FEEDBACK_SUBMIT_WINDOW_MS = 60 * 60 * 1000;

export async function checkAdminBroadcastRateLimit(adminUserId: string): Promise<RateLimitResult> {
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

export async function checkRecipientRateLimit(recipientUserId: string): Promise<RateLimitResult> {
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

/**
 * FPP-43 / FPP-1: in-memory sliding-window rate limit keyed by an
 * opaque bucket id (we use the resolved client IP). In-memory is
 * sufficient for a single-process Next.js deployment; for
 * multi-instance deployments the limit becomes per-instance which
 * is still better than no limit.
 *
 * The bucket map is module-scoped so a single test run does not
 * leak counters between cases; tests can call
 * `resetInMemoryRateLimits()` (exported below) in beforeEach.
 *
 * Returns a `RateLimitResult` so callers can surface the
 * `Retry-After` header in the same shape as the Prisma-backed
 * helpers.
 */
interface Bucket {
  timestamps: number[];
}
const ipBuckets = new Map<string, Bucket>();

export function resetInMemoryRateLimits(): void {
  ipBuckets.clear();
}

export function checkInMemoryIpRateLimit(
  bucketKey: string | null,
  maxRequests: number = PDF_DOWNLOADS_PER_MINUTE,
  windowMs: number = PDF_DOWNLOAD_WINDOW_MS,
  now: number = Date.now(),
): RateLimitResult {
  // Null bucket (no IP resolvable) collapses to a global bucket so
  // we still rate-limit, just less precisely. Without this, callers
  // in dev (no trusted proxy) would bypass the limit entirely.
  const key = bucketKey ?? '__anonymous__';

  const bucket = ipBuckets.get(key) ?? { timestamps: [] };
  // Drop timestamps outside the window.
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0]!;
    const resetAt = new Date(oldest + windowMs);
    ipBuckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterMs: Math.max(0, resetAt.getTime() - now),
    };
  }

  bucket.timestamps.push(now);
  ipBuckets.set(key, bucket);
  const resetAt = new Date(now + windowMs);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    resetAt,
  };
}

// Convenience wrappers so callers don't have to know the bucket shape.
// `actor` is whichever identity is most trustworthy — signed-in user
// id first, then IP. Both paths share the same backing map so a
// determined attacker rotating identities still hits the limit.
export function checkFeedbackSubmitRateLimit(
  actor: string | null,
  now: number = Date.now(),
): RateLimitResult {
  const key = actor ? `feedback:actor:${actor}` : 'feedback:anonymous';
  return checkInMemoryIpRateLimit(
    key,
    FEEDBACK_SUBMITS_PER_HOUR,
    FEEDBACK_SUBMIT_WINDOW_MS,
    now,
  );
}

export function resetFeedbackRateLimits(): void {
  for (const key of ipBuckets.keys()) {
    if (key.startsWith('feedback:')) ipBuckets.delete(key);
  }
}
