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
    route: '/api/potluck-signup',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session?.user?.id, '/api/potluck-signup'),
    async () => {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      }

      let slotId: string | undefined;

      try {
        const body = await request.json();
        const { slotId: reqSlotId, action, dishName, servings, dietaryLabels } = body;
        slotId = reqSlotId;

        if (!slotId || !action) {
          return NextResponse.json(
            { error: 'slotId and action are required', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (action === 'signup') {
          const signupResult = z
            .object({
              slotId: z.string().min(1),
              dishName: z.string().min(1, 'Dish name is required').trim().min(1),
              servings: z.number().int().min(1).default(1),
              dietaryLabels: z.array(z.string()).default([]),
            })
            .safeParse({ slotId, dishName, servings, dietaryLabels });

          if (!signupResult.success) {
            const errors = signupResult.error.issues.map((i) => i.message);
            return NextResponse.json(
              { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }
        } else if (action === 'cancel') {
          const cancelResult = z
            .object({
              slotId: z.string().min(1),
            })
            .safeParse({ slotId });

          if (!cancelResult.success) {
            const errors = cancelResult.error.issues.map((i) => i.message);
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

        const slot = await prisma.potluckSlot.findUnique({
          where: { id: slotId },
          include: { event: true },
        });

        if (!slot) {
          return NextResponse.json({ error: 'Slot not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        if (slot.event.status !== EventStatus.PUBLISHED) {
          return NextResponse.json(
            { error: 'Event is not accepting potluck signups', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
        });

        if (!user) {
          return NextResponse.json({ error: 'User not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        const rsvp = await prisma.rSVP.findUnique({
          where: {
            eventId_userId: {
              eventId: slot.eventId,
              userId: session.user.id,
            },
          },
        });

        if (!rsvp || rsvp.status !== RSVPStatus.CONFIRMED) {
          return NextResponse.json(
            { error: 'You must have a confirmed RSVP to sign up for potluck', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (action === 'signup') {
          if (!dishName || dishName.trim() === '') {
            return NextResponse.json(
              { error: 'Dish name is required', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }

          const existingSignup = await prisma.potluckSignup.findUnique({
            where: {
              slotId_rsvpId: {
                slotId: slotId!,
                rsvpId: rsvp.id,
              },
            },
          });

          if (slot.slotType === 'LIMITED') {
            const maxSignups = slot.maxSignups || 0;
            await prisma.$transaction(
              async (tx) => {
                const currentSignups = await tx.potluckSignup.count({
                  where: { slotId: slotId! },
                });
                const effectiveCount = existingSignup ? currentSignups - 1 : currentSignups;
                if (effectiveCount >= maxSignups) {
                  throw new Error('Slot is full');
                }
                if (existingSignup) {
                  await tx.potluckSignup.update({
                    where: { id: existingSignup.id },
                    data: {
                      dishName: dishName.trim(),
                      servings: servings || 1,
                      dietaryLabels: dietaryLabels || [],
                    },
                  });
                } else {
                  await tx.potluckSignup.create({
                    data: {
                      slotId: slotId!,
                      rsvpId: rsvp.id,
                      dishName: dishName.trim(),
                      servings: servings || 1,
                      dietaryLabels: dietaryLabels || [],
                    },
                  });
                  await tx.potluckSlot.update({
                    where: { id: slotId! },
                    data: { currentSignups: { increment: 1 } },
                  });
                }
              },
              {
                isolationLevel: 'Serializable',
              },
            );
            return NextResponse.json({
              success: true,
              action: existingSignup ? 'updated' : 'created',
            });
          }

          if (existingSignup) {
            await prisma.potluckSignup.update({
              where: { id: existingSignup.id },
              data: {
                dishName: dishName.trim(),
                servings: servings || 1,
                dietaryLabels: dietaryLabels || [],
              },
            });
            return NextResponse.json({ success: true, action: 'updated' });
          }

          await prisma.potluckSignup.create({
            data: {
              slotId: slotId!,
              rsvpId: rsvp.id,
              dishName: dishName.trim(),
              servings: servings || 1,
              dietaryLabels: dietaryLabels || [],
            },
          });

          return NextResponse.json({ success: true, action: 'created' });
        }

        if (action === 'cancel') {
          const existingSignup = await prisma.potluckSignup.findUnique({
            where: {
              slotId_rsvpId: {
                slotId: slotId!,
                rsvpId: rsvp.id,
              },
            },
          });

          if (!existingSignup) {
            return NextResponse.json(
              { error: 'Signup not found', code: 'NOT_FOUND' },
              { status: 404 },
            );
          }

          await prisma.potluckSignup.delete({
            where: { id: existingSignup.id },
          });

          await prisma.potluckSlot.update({
            where: { id: slotId! },
            data: { currentSignups: { decrement: 1 } },
          });

          return NextResponse.json({ success: true, action: 'cancelled' });
        }

        return NextResponse.json({ error: 'Invalid action', code: 'BAD_REQUEST' }, { status: 400 });
      } catch (error) {
        log.error({ err: error, slotId }, 'Potluck signup error');
        if (error instanceof Error && error.message === 'Slot is full') {
          return NextResponse.json(
            { error: 'This slot is full', code: 'CONFLICT' },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
          { status: 500 },
        );
      }
    },
  );
}
