import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';
import { writeAuditLog } from '~/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-70: re-opens a CLOSED event back to PUBLISHED. Mirrors the
 * close/publish/cancel routes (per-event gate via
 * `requireEventAdminApi` so a HOST can re-open their own event) and
 * the tRPC `event.reopen` procedure.
 *
 * Transition guard: only CLOSED -> PUBLISHED is valid. The strict
 * equality check rejects every other source status — including a
 * future ARCHIVED status (QUB-12) — so re-open is never applied
 * to an open, draft, cancelled, or archived event.
 *
 * QUB-26.1: the transition is recorded in the admin audit log with
 * the actor, event, and old/new status. Unlike publish, no
 * notification is sent: households that already RSVPed are NOT
 * re-notified on re-open.
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

    if (event.status !== EventStatus.CLOSED) {
      return NextResponse.json({ error: 'Only CLOSED events can be re-opened' }, { status: 400 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { status: EventStatus.PUBLISHED },
    });

    await writeAuditLog({
      userId: auth.session.user.id,
      eventId: event.id,
      action: 'event.reopen',
      oldValue: { status: event.status },
      newValue: { status: EventStatus.PUBLISHED },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to re-open event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
