import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, maxSignups } = body;

    const slot = await prisma.potluckSlot.findUnique({ where: { id } });
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    const updateData: { name?: string; maxSignups?: number | null } = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (maxSignups !== undefined) {
      if (slot.slotType === 'LIMITED') {
        if (!maxSignups || maxSignups < 1) {
          return NextResponse.json(
            { error: 'maxSignups must be at least 1 for LIMITED slots' },
            { status: 400 },
          );
        }
        updateData.maxSignups = maxSignups;
      }
    }

    const updatedSlot = await prisma.potluckSlot.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedSlot);
  } catch (error) {
    console.error('Failed to update potluck slot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const slot = await prisma.potluckSlot.findUnique({ where: { id } });
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    await prisma.potluckSlot.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete potluck slot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
