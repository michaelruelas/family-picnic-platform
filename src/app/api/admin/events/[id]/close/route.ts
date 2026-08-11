import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-104: per-event gate. Mirrors the tRPC `event.close`
 * procedure's move to `eventAdminProcedure` so a HOST can close
 * their own event. The PUBLISHED-only guard is unchanged.
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

    if (event.status !== EventStatus.PUBLISHED) {
      return NextResponse.json({ error: 'Only PUBLISHED events can be closed' }, { status: 400 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { status: EventStatus.CLOSED },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to close event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
