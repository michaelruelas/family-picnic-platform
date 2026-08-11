import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-104: per-event gate. Mirrors the tRPC `event.cancel`
 * procedure's move to `eventAdminProcedure` so a HOST can cancel
 * their own event. The CLOSED guard is unchanged.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const auth = await requireEventAdminApi(id);
  if (!auth.ok) return auth.response;
  void auth.session;

  try {
    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status === EventStatus.CLOSED) {
      return NextResponse.json({ error: 'CLOSED events cannot be cancelled' }, { status: 400 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to cancel event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
