import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

export async function GET(request: NextRequest) {
  // FPP-104: stays super-admin only. Broadcast status is a
  // cross-event audit view; per-event hosts see their own delivery
  // status via the events page.
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const eventId = request.nextUrl.searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const logs = await prisma.communicationLog.findMany({
      where: { eventId },
      orderBy: { attemptedAt: 'desc' },
      include: {
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching delivery status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
