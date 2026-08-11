import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdminRole } from '~/lib/auth';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { AdminPermission } from '~/lib/generated/enums';
import { writeDomainAuditLog } from '~/lib/audit';
import { createRequestLogger } from '~/lib/logger';
import { stampHostRole, unassignHostRole } from '~/lib/event-access';

/**
 * FPP-65 / QUB-13.2: host assignment.
 *
 * Accepts either a single `{ userId, role }` payload (legacy contract
 * used by `EventAdminsClient.tsx`'s single-add picker) OR a bulk
 * `{ userIds: string[], role }` payload (used by the multi-select on
 * the same page). On success, every assigned user gets:
 *
 *   1. An `EventAdmin` row with the requested role (defaulting to
 *      `OWNER` for host picks — see FPP-65 spec).
 *   2. `User.role = HOST` (only if the requestor chose `OWNER` AND
 *      the user is not already a super-admin). SUPER_ADMIN is never
 *      demoted by a host assignment.
 *   3. A domain-audit-log entry per assignment under
 *      `subjectType: 'EventAdmin'`, `subjectId: '${eventId}:${userId}'`.
 *
 * The endpoint also emits an email-notification stub to the server log.
 * Real send is intentionally not wired (the spec says "body TBD; no
 * real send yet"); once the host-notification template lands we just
 * swap the stub for a SendGrid call.
 *
 * FPP-65 audit: gating is `requireEventAdminApi(eventId)` (super-admin
 * OR HOST with an EventAdmin row for this event). The block-level
 * check below additionally rejects self-assignment for non-super-admin
 * callers so a HOST cannot silently add themselves to a different role
 * row they were already assigned to.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const auth = await requireEventAdminApi(eventId);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json();
  const {
    userId,
    userIds,
    role = AdminPermission.OWNER,
    sendNotification = true,
  }: {
    userId?: string;
    userIds?: string[];
    role?: AdminPermission;
    sendNotification?: boolean;
  } = body ?? {};

  const targetUserIds = collectTargetUserIds(userId, userIds);

  if (targetUserIds.length === 0) {
    return NextResponse.json({ error: 'userId or userIds is required' }, { status: 400 });
  }

  if (!isValidAdminPermission(role)) {
    return NextResponse.json({ error: 'invalid role' }, { status: 400 });
  }

  // FPP-65 audit / FPP-104 followup: defensive self-assignment
  // check. Only SUPER_ADMIN can include themselves in the target
  // list. We use `isSuperAdminRole` (not `isAdminRole`) so a
  // default `ADMIN_ADULT` user cannot self-promote to OWNER on an
  // event they already have a row for. The previous check used
  // `isAdminRole`, which let ADMIN_ADULT users through; the impact
  // was bounded (canAccessEvent is role-agnostic, so they did not
  // gain extra access), but the comment claimed "only super-admins"
  // which was inaccurate. Tightened to `isSuperAdminRole` to match.
  const actorIsSuperAdmin = isSuperAdminRole(session.user.role);
  if (!actorIsSuperAdmin && targetUserIds.includes(session.user.id)) {
    return NextResponse.json(
      { error: 'only super-admins can self-assign via this endpoint' },
      { status: 403 },
    );
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const uniqueUserIds = Array.from(new Set(targetUserIds));

  const existing = await prisma.eventAdmin.findMany({
    where: { eventId, userId: { in: uniqueUserIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((row) => row.userId));
  const toAssign = uniqueUserIds.filter((id) => !existingIds.has(id));

  if (toAssign.length === 0) {
    return NextResponse.json(
      {
        assigned: [],
        skipped: uniqueUserIds,
        reason: 'all-already-assigned',
      },
      { status: 200 },
    );
  }

  // FPP-65: when the admin assigns an OWNER role, stamp the user's
  // platform-level role to HOST so downstream code (audit log filters,
  // dashboard "hosts" filter, future role-based UI) can identify them
  // without re-querying EventAdmin. `stampHostRole` skips
  // super-admins internally so they are never demoted.
  const created = await prisma.$transaction(async (tx) => {
    const rows = await Promise.all(
      toAssign.map((uid) =>
        tx.eventAdmin.create({
          data: { eventId, userId: uid, role: role as AdminPermission },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                household: { select: { name: true } },
              },
            },
          },
        }),
      ),
    );

    if (role === AdminPermission.OWNER) {
      await stampHostRole(toAssign, tx);
    }

    return rows;
  });

  await Promise.all(
    created.map((row) =>
      writeDomainAuditLog({
        actorId: session.user.id,
        action: 'event.admin.add',
        subjectType: 'EventAdmin',
        subjectId: `${eventId}:${row.userId}`,
        payload: { eventId, userId: row.userId, role, source: 'rest' },
      }),
    ),
  );

  if (sendNotification && role === AdminPermission.OWNER) {
    const log = createRequestLogger({
      requestId: `host-assign-${eventId}`,
      userId: session.user.id,
      route: '/api/admin/events/[id]/admins',
    });
    for (const row of created) {
      log.info(
        {
          kind: 'host-assignment-notification',
          eventId,
          eventName: event.name,
          recipientUserId: row.userId,
          recipientEmail: row.user.email,
          assignedBy: session.user.id,
          template: 'host-assigned',
          body: null,
        },
        '[FPP-65 stub] host assignment notification (no real send yet)',
      );
    }
  }

  return NextResponse.json(
    {
      assigned: created,
      skipped: Array.from(existingIds),
    },
    { status: 201 },
  );
}

function collectTargetUserIds(userId: string | undefined, userIds: string[] | undefined): string[] {
  const out: string[] = [];
  if (typeof userId === 'string' && userId.length > 0) out.push(userId);
  if (Array.isArray(userIds)) {
    for (const id of userIds) {
      if (typeof id === 'string' && id.length > 0) out.push(id);
    }
  }
  return out;
}

const VALID_ADMIN_PERMISSIONS: AdminPermission[] = [
  AdminPermission.OWNER,
  AdminPermission.COADMIN,
  AdminPermission.INVITER,
];

function isValidAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === 'string' && (VALID_ADMIN_PERMISSIONS as string[]).includes(value);
}

// FPP-65 audit: re-exported so the DELETE handler can run the same
// un-stamp logic. The function lives in `event-access.ts` so REST
// and tRPC stay in lockstep.
export { unassignHostRole };
