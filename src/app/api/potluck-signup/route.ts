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

      try {
        const body = await request.json();
        const { action } = body;

        // Multi-claim: the REST contract mirrors the tRPC procedures.
        // `signup` is keyed by `slotId` (creates a new row each call);
        // `cancel` is keyed by `signupId` so it can target one of
        // several rows the caller may own on the same slot.
        if (action === 'signup') {
          const signupResult = z
            .object({
              slotId: z.string().min(1, 'Slot ID is required'),
              dishName: z.string().min(1, 'Dish name is required').trim().min(1),
              servings: z.number().int().min(1).default(1),
              dietaryLabels: z.array(z.string()).default([]),
            })
            .safeParse(body);

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
              signupId: z.string().min(1, 'Signup ID is required'),
            })
            .safeParse(body);

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

        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
        });

        if (!user) {
          return NextResponse.json({ error: 'User not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        if (action === 'signup') {
          const { slotId, dishName, servings, dietaryLabels } = body as {
            slotId: string;
            dishName: string;
            servings?: number;
            dietaryLabels?: string[];
          };

          const slot = await prisma.potluckSlot.findUnique({
            where: { id: slotId },
            include: { event: true },
          });

          if (!slot) {
            return NextResponse.json(
              { error: 'Slot not found', code: 'NOT_FOUND' },
              { status: 404 },
            );
          }

          if (slot.event.status !== EventStatus.PUBLISHED) {
            return NextResponse.json(
              { error: 'Event is not accepting potluck signups', code: 'BAD_REQUEST' },
              { status: 400 },
            );
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
              {
                error: 'You must have a confirmed RSVP to sign up for potluck',
                code: 'BAD_REQUEST',
              },
              { status: 400 },
            );
          }

          if (slot.slotType === 'LIMITED') {
            const maxSignups = slot.maxSignups || 0;
            await prisma.$transaction(
              async (tx) => {
                const currentSignups = await tx.potluckSignup.count({
                  where: { slotId },
                });
                if (currentSignups >= maxSignups) {
                  throw new Error('Slot is full');
                }
                await tx.potluckSignup.create({
                  data: {
                    slotId,
                    rsvpId: rsvp.id,
                    dishName: dishName.trim(),
                    servings: servings || 1,
                    dietaryLabels: dietaryLabels || [],
                  },
                });
                await tx.potluckSlot.update({
                  where: { id: slotId },
                  data: { currentSignups: { increment: 1 } },
                });
              },
              {
                isolationLevel: 'Serializable',
              },
            );
            return NextResponse.json({ success: true, action: 'created' });
          }

          await prisma.potluckSignup.create({
            data: {
              slotId,
              rsvpId: rsvp.id,
              dishName: dishName.trim(),
              servings: servings || 1,
              dietaryLabels: dietaryLabels || [],
            },
          });

          return NextResponse.json({ success: true, action: 'created' });
        }

        // action === 'cancel'
        const { signupId } = body as { signupId: string };

        // FPP-Postmortem: filter `deletedAt: null` so an already-cancelled
        // signup returns 404 instead of being silently re-cancelled.
        const signup = await prisma.potluckSignup.findUnique({
          where: { id: signupId },
          include: { slot: true },
        });

        if (!signup || signup.deletedAt !== null) {
          return NextResponse.json(
            { error: 'Signup not found', code: 'NOT_FOUND' },
            { status: 404 },
          );
        }

        // Verify the caller owns the signup. REST mirrors the tRPC
        // contract: walking through the signup → slot → RSVP is the
        // authoritative check; we don't trust client-supplied slotId.
        const rsvp = await prisma.rSVP.findUnique({
          where: {
            eventId_userId: {
              eventId: signup.slot.eventId,
              userId: session.user.id,
            },
          },
          select: { id: true },
        });

        if (!rsvp || rsvp.id !== signup.rsvpId) {
          return NextResponse.json(
            { error: 'Signup not found', code: 'NOT_FOUND' },
            { status: 404 },
          );
        }

        // FPP-Postmortem: soft-delete (set deletedAt) instead of hard
        // delete. The DB trigger blocks direct DELETE statements.
        await prisma.potluckSignup.update({
          where: { id: signup.id },
          data: { deletedAt: new Date() },
        });

        await prisma.potluckSlot.update({
          where: { id: signup.slotId },
          data: { currentSignups: { decrement: 1 } },
        });

        return NextResponse.json({ success: true, action: 'cancelled' });
      } catch (error) {
        log.error({ err: error }, 'Potluck signup error');
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
