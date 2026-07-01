import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus } from '~/lib/generated/enums';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { eventId, action, headcount, dietaryNotes } = body;

    if (!eventId || !action) {
      return NextResponse.json({ error: 'eventId and action are required' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Event is not accepting RSVPs' }, { status: 400 });
    }

    if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()) {
      return NextResponse.json({ error: 'RSVP deadline has passed' }, { status: 400 });
    }

    if (action === 'confirm' || action === 'decline') {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const rsvpData = {
        eventId,
        userId: session.user.id,
        householdId: user.householdId || user.id,
        status: action === 'confirm' ? RSVPStatus.CONFIRMED : RSVPStatus.DECLINED,
        headcount: action === 'confirm' ? headcount || 1 : 0,
        dietaryNotes: action === 'confirm' ? dietaryNotes || null : null,
        respondedAt: new Date(),
      };

      await prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId: session.user.id,
          },
        },
        update: {
          status: rsvpData.status,
          headcount: rsvpData.headcount,
          dietaryNotes: rsvpData.dietaryNotes,
          respondedAt: rsvpData.respondedAt,
        },
        create: rsvpData,
      });

      return NextResponse.json({ success: true, status: rsvpData.status });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('RSVP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
