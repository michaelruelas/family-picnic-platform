import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { writeAuditLog } from '~/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-68 / QUB-12: unarchives an event by clearing `archivedAt`.
 *
 * Inverse of archive: returns an archived event to the active admin
 * list without touching its `status`. Idempotent: unarchiving a
 * non-archived event returns 200 with the existing row and writes
 * no new audit entry.
 *
 * Per-event gate (`requireEventAdminApi`) so a HOST with an
 * EventAdmin row can unarchive their own event. Mirrors the tRPC
 * `event.unarchive` procedure and QUB-26.1 audit shape.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const auth = await requireEventAdminApi(id);
  if (!auth.ok) return auth.response;

  try {
    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.archivedAt) {
      return NextResponse.json(event);
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { archivedAt: null },
    });

    await writeAuditLog({
      userId: auth.session.user.id,
      eventId: event.id,
      action: 'event.unarchive',
      oldValue: { archivedAt: event.archivedAt },
      newValue: { archivedAt: null },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to unarchive event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
