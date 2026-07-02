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

      if (action === 'confirm' && event.maxCapacity) {
        const currentHeadcount = await prisma.rSVP.aggregate({
          where: {
            eventId,
            status: RSVPStatus.CONFIRMED,
            userId: { not: session.user.id },
          },
          _sum: { headcount: true },
        });

        const totalAfterRsvp = (currentHeadcount._sum.headcount || 0) + (headcount || 1);
        if (totalAfterRsvp > event.maxCapacity) {
          const spotsRemaining = event.maxCapacity - (currentHeadcount._sum.headcount || 0);
          return NextResponse.json(
            {
              error:
                spotsRemaining <= 0
                  ? 'Event is full'
                  : `Only ${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} remaining`,
            },
            { status: 400 },
          );
        }
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

      if (action === 'decline') {
        await prisma.$transaction(async (tx) => {
          const existingRsvp = await tx.rSVP.findUnique({
            where: {
              eventId_userId: {
                eventId,
                userId: session.user.id,
              },
            },
            include: {
              potluckSignups: {
                include: { slot: true },
              },
            },
          });

          for (const signup of existingRsvp?.potluckSignups || []) {
            await tx.potluckSlot.update({
              where: { id: signup.slotId },
              data: { currentSignups: { decrement: signup.servings } },
            });
          }

          await tx.potluckSignup.deleteMany({
            where: { rsvpId: existingRsvp?.id },
          });

          await tx.rSVP.upsert({
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

          await tx.adminAuditLog.create({
            data: {
              userId: session.user.id,
              eventId,
              action: 'POTLUCK_SLOT_RELEASE',
              oldValue: { status: existingRsvp?.status, headcount: existingRsvp?.headcount },
              newValue: { status: RSVPStatus.DECLINED, headcount: 0, slotsReleased: existingRsvp?.potluckSignups.length || 0 },
            },
          });
        });

        return NextResponse.json({ success: true, status: RSVPStatus.DECLINED });
      }

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
