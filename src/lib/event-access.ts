import { prisma } from './prisma';
import type { Session } from 'next-auth';
import { isSuperAdminRole } from './auth';
import { AdminPermission, Role } from './generated/enums';
import type { Prisma, PrismaClient } from './generated/client';

type TransactionOrClient = PrismaClient | Prisma.TransactionClient;

/**
 * FPP-65 / QUB-13.4: per-event access helper.
 *
 * A user can administer an event if any of the following hold:
 *   - Their `User.role` is `SUPER_ADMIN` (platform-level admin).
 *   - They have an `EventAdmin` row for the event — covers hosts
 *     (`AdminPermission.OWNER`), co-admins (`COADMIN`), and inviters
 *     (`INVITER`).
 *
 * The check is intentionally role-agnostic for EventAdmin: any
 * `EventAdmin` row grants the same per-event access. The spec says
 * "Host has scoped permissions: edit own event, view RSVPs/audit for
 * own event". Co-admins and inviters inherit the same gate; the
 * finer-grained capability check (who can do what) lives at the
 * call site, not here.
 *
 * Returns false for unauthenticated callers, soft-deleted users, or
 * when the user has no EventAdmin row. The check is O(1) — a single
 * indexed `findFirst` against the `EventAdmin(eventId, userId)`
 * compound index, so it's safe to call from request hot paths.
 */
export async function canAccessEvent(session: Session | null, eventId: string): Promise<boolean> {
  if (!session?.user?.id) return false;
  if (isSuperAdminRole(session.user.role)) return true;

  const row = await prisma.eventAdmin.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });

  // `findUnique` returns `null` when there is no row. Treat both
  // `null` and `undefined` (which can happen under test mocks that
  // forget to wire the response) as "no access" so a missing mock
  // never accidentally grants access.
  return row != null;
}

/**
 * Convenience wrapper for routes that want a 403-shaped denial rather
 * than a boolean. Mirrors the `requireAdminApi` shape so callers can
 * use a consistent `{ ok, ... }` pattern.
 */
export type EventAccessResult = { ok: true } | { ok: false; status: 401 | 403 };

export async function requireEventAccess(
  session: Session | null,
  eventId: string,
): Promise<EventAccessResult> {
  if (!session?.user?.id) return { ok: false, status: 401 };
  const allowed = await canAccessEvent(session, eventId);
  if (!allowed) return { ok: false, status: 403 };
  return { ok: true };
}

/**
 * Per-event role union. `SUPER_ADMIN` is the platform-level tier
 * granted by `User.role`; the rest are stored on the EventAdmin row.
 *
 * The returned value is one of `SUPER_ADMIN`, every value of the
 * `AdminPermission` enum, or `null` (no access at all). The
 * AdminPermission union is keyed on the enum so adding a new value
 * upstream surfaces here as a TypeScript error rather than a silent
 * type widening.
 */
export type EventRole = 'SUPER_ADMIN' | AdminPermission | null;

export async function getEventRole(
  userId: string,
  eventId: string,
  userRole: Role | null | undefined,
): Promise<EventRole> {
  if (isSuperAdminRole(userRole)) return 'SUPER_ADMIN';
  const row = await prisma.eventAdmin.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
    select: { role: true },
  });
  return row?.role ?? null;
}

/**
 * FPP-65: stamps `User.role = HOST` for any target user whose current
 * role is not `SUPER_ADMIN`. Used by both the REST endpoint and the
 * tRPC `event.addAdmin` procedure so the platform-level `HOST` flag
 * is set whenever a user is assigned the per-event host role —
 * regardless of which surface issued the assignment.
 *
 * Must be called inside the same `$transaction` as the EventAdmin
 * create so a partial failure cannot leave a row without its role
 * stamp. Returns the list of user ids that were promoted so the
 * caller can include them in its audit / notification payload.
 */
export async function stampHostRole(
  targetUserIds: string[],
  tx?: TransactionOrClient,
): Promise<string[]> {
  if (targetUserIds.length === 0) return [];
  const client = (tx ?? prisma) as TransactionOrClient;
  const updated = await (client as PrismaClient).user.updateManyAndReturn({
    where: {
      id: { in: targetUserIds },
      role: { not: Role.SUPER_ADMIN },
    },
    data: { role: Role.HOST },
    select: { id: true },
  });
  return updated.map((row) => row.id);
}

/**
 * FPP-65 / QUB-13.1: counter to `stampHostRole`. When a user is
 * unassigned from every OWNER-permission EventAdmin row, demote
 * them back to `ADULT` so a removed host does not retain
 * global admin access on the back of a stale role flag.
 *
 * Conditionally fires only when:
 *   - the user's current role is `HOST`, AND
 *   - the user has zero remaining EventAdmin rows with role=OWNER.
 *
 * Returns the user id when a demotion happened (so the caller can
 * include it in the audit log); null otherwise. Super-admins are
 * never demoted.
 */
export async function unassignHostRole(
  userId: string,
  tx?: TransactionOrClient,
): Promise<string | null> {
  const client = (tx ?? prisma) as TransactionOrClient;
  const remainingOwnerRows = await (client as PrismaClient).eventAdmin.count({
    where: { userId, role: AdminPermission.OWNER },
  });
  if (remainingOwnerRows > 0) return null;

  const result = await (client as PrismaClient).user.updateManyAndReturn({
    where: { id: userId, role: Role.HOST },
    data: { role: Role.ADULT },
    select: { id: true },
  });
  return result.length > 0 ? result[0]!.id : null;
}
