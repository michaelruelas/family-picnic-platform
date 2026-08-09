import { NextRequest, NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { writeDomainAuditLog } from '~/lib/audit';
import { AdminPermission } from '~/lib/generated/enums';
import { unassignHostRole } from '~/lib/event-access';

/**
 * FPP-65 / QUB-13.1: per-event gated removal. The actor must be
 * either a platform-level admin OR a HOST with an EventAdmin row
 * for the event (the latter only ever for hosts of the same event).
 *
 * FPP-65 audit: when the removed row had role=OWNER, also run
 * `unassignHostRole` so the user is demoted back to ADMIN_ADULT
 * if they no longer hold any OWNER-permission row. The un-stamp
 * is atomic with the EventAdmin delete so a partial failure cannot
 * leave a stale `HOST` flag on a user with no events.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id: eventId, userId } = await params;
  const auth = await requireEventAdminApi(eventId);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const admin = await prisma.eventAdmin.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  const removed = await prisma.$transaction(async (tx) => {
    const row = await tx.eventAdmin.delete({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (row.role === AdminPermission.OWNER) {
      await unassignHostRole(userId, tx);
    }

    return row;
  });

  await writeDomainAuditLog({
    actorId: session.user.id,
    action: 'event.admin.remove',
    subjectType: 'EventAdmin',
    subjectId: `${eventId}:${userId}`,
    payload: {
      eventId,
      userId,
      role: removed.role,
      demoted: removed.role === AdminPermission.OWNER,
    },
  });

  return NextResponse.json({ success: true });
}
