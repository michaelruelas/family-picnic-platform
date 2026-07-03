import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus, EventStatus } from '~/lib/generated/enums';
import { z } from 'zod';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const session = await getServerSession(authOptions);

  const log = createRequestLogger({
    requestId,
    userId: session?.user?.id,
    route: '/api/rsvp',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session?.user?.id, '/api/rsvp'),
    async () => {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      }

      let eventId: string | undefined;

      try {
        const body = await request.json();
        const { eventId: reqEventId, action, headcount, dietaryNotes } = body;
        eventId = reqEventId;

        if (!eventId || !action) {
          return NextResponse.json(
            { error: 'eventId and action are required', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (action === 'confirm') {
          const confirmResult = z
            .object({
              eventId: z.string().min(1),
              headcount: z.number().int().min(1).default(1),
              dietaryNotes: z.string().optional(),
            })
            .safeParse({ eventId, headcount, dietaryNotes });

          if (!confirmResult.success) {
            const errors = confirmResult.error.issues.map((i) => i.message);
            return NextResponse.json(
              { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }
        } else if (action === 'decline') {
          const declineResult = z
            .object({
              eventId: z.string().min(1),
            })
            .safeParse({ eventId });

          if (!declineResult.success) {
            const errors = declineResult.error.issues.map((i) => i.message);
            return NextResponse.json(
              { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }
        } else {
          return NextResponse.json(
            { error: 'Invalid action', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        const event = await prisma.event.findUnique({
          where: { id: eventId },
        });

        if (!event) {
          return NextResponse.json(
            { error: 'Event not found', code: 'NOT_FOUND' },
            { status: 404 },
          );
        }

        if (event.status !== EventStatus.PUBLISHED) {
          return NextResponse.json(
            { error: 'Event is not accepting RSVPs', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()) {
          return NextResponse.json(
            { error: 'RSVP deadline has passed', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (action === 'confirm' || action === 'decline') {
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
          });

          if (!user) {
            return NextResponse.json(
              { error: 'User not found', code: 'NOT_FOUND' },
              { status: 404 },
            );
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
              const nextPosition = await prisma.rSVP.aggregate({
                where: {
                  eventId,
                  status: RSVPStatus.WAITLISTED,
                },
                _max: { waitlistPosition: true },
              });
              const waitlistPosition = (nextPosition._max.waitlistPosition || 0) + 1;

              await prisma.rSVP.upsert({
                where: {
                  eventId_userId: {
                    eventId: eventId!,
                    userId: session.user.id,
                  },
                },
                update: {
                  status: RSVPStatus.WAITLISTED,
                  headcount: headcount || 1,
                  dietaryNotes: dietaryNotes || null,
                  respondedAt: new Date(),
                  waitlistPosition,
                },
                create: {
                  eventId: eventId!,
                  userId: session.user.id,
                  householdId: user.householdId || user.id,
                  status: RSVPStatus.WAITLISTED,
                  headcount: headcount || 1,
                  dietaryNotes: dietaryNotes || null,
                  respondedAt: new Date(),
                  waitlistPosition,
                },
              });

              return NextResponse.json({
                success: true,
                status: RSVPStatus.WAITLISTED,
                waitlistPosition,
              });
            }
          }

          const rsvpData = {
            eventId: eventId!,
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
                    eventId: eventId!,
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
                    eventId: eventId!,
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
                  eventId: eventId!,
                  action: 'POTLUCK_SLOT_RELEASE',
                  oldValue: { status: existingRsvp?.status, headcount: existingRsvp?.headcount },
                  newValue: {
                    status: RSVPStatus.DECLINED,
                    headcount: 0,
                    slotsReleased: existingRsvp?.potluckSignups.length || 0,
                  },
                },
              });

              const firstWaitlisted = await tx.rSVP.findFirst({
                where: {
                  eventId: eventId!,
                  status: RSVPStatus.WAITLISTED,
                },
                orderBy: { waitlistPosition: 'asc' },
              });

              if (firstWaitlisted) {
                await tx.rSVP.update({
                  where: { id: firstWaitlisted.id },
                  data: {
                    status: RSVPStatus.CONFIRMED,
                    waitlistPosition: null,
                    respondedAt: new Date(),
                  },
                });

                await tx.rSVP.updateMany({
                  where: {
                    eventId: eventId!,
                    status: RSVPStatus.WAITLISTED,
                    waitlistPosition: { gt: firstWaitlisted.waitlistPosition! },
                  },
                  data: {
                    waitlistPosition: { decrement: 1 },
                  },
                });

                await tx.adminAuditLog.create({
                  data: {
                    userId: firstWaitlisted.userId,
                    eventId: eventId!,
                    action: 'WAITLIST_PROMOTION',
                    oldValue: {
                      status: RSVPStatus.WAITLISTED,
                      position: firstWaitlisted.waitlistPosition,
                    },
                    newValue: { status: RSVPStatus.CONFIRMED },
                  },
                });
              }
            });

            return NextResponse.json({ success: true, status: RSVPStatus.DECLINED });
          }

          await prisma.rSVP.upsert({
            where: {
              eventId_userId: {
                eventId: eventId!,
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

        return NextResponse.json({ error: 'Invalid action', code: 'BAD_REQUEST' }, { status: 400 });
      } catch (error) {
        log.error({ err: error, eventId }, 'RSVP error');
        return NextResponse.json(
          { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
          { status: 500 },
        );
      }
    },
  );
}
