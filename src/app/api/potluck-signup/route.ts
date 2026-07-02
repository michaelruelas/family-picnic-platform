import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slotId, action, dishName, servings, dietaryLabels } = body;

    if (!slotId || !action) {
      return NextResponse.json({ error: 'slotId and action are required' }, { status: 400 });
    }

    const slot = await prisma.potluckSlot.findUnique({
      where: { id: slotId },
      include: { event: true },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    if (slot.event.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Event is not accepting potluck signups' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const rsvp = await prisma.rSVP.findUnique({
      where: {
        eventId_userId: {
          eventId: slot.eventId,
          userId: session.user.id,
        },
      },
    });

    if (!rsvp || rsvp.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'You must have a confirmed RSVP to sign up for potluck' },
        { status: 400 },
      );
    }

    if (action === 'signup') {
      if (!dishName || dishName.trim() === '') {
        return NextResponse.json({ error: 'Dish name is required' }, { status: 400 });
      }

      const existingSignup = await prisma.potluckSignup.findUnique({
        where: {
          slotId_rsvpId: {
            slotId,
            rsvpId: rsvp.id,
          },
        },
      });

      if (slot.slotType === 'LIMITED') {
        const maxSignups = slot.maxSignups || 0;
        await prisma.$transaction(async (tx) => {
          const currentSignups = await tx.potluckSignup.count({
            where: { slotId },
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
          }
        }, {
          isolationLevel: 'Serializable',
        });
        return NextResponse.json({ success: true, action: existingSignup ? 'updated' : 'created' });
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
          slotId,
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
            slotId,
            rsvpId: rsvp.id,
          },
        },
      });

      if (!existingSignup) {
        return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
      }

      await prisma.potluckSignup.delete({
        where: { id: existingSignup.id },
      });

      await prisma.potluckSlot.update({
        where: { id: slotId },
        data: { currentSignups: { decrement: 1 } },
      });

      return NextResponse.json({ success: true, action: 'cancelled' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Potluck signup error:', error);
    if (error instanceof Error && error.message === 'Slot is full') {
      return NextResponse.json({ error: 'This slot is full' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
