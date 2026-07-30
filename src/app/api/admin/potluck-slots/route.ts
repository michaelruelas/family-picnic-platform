import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await request.json();
    const { eventId, category, name, slotType, maxSignups } = body;

    if (!eventId || !category || !name || !slotType) {
      return NextResponse.json(
        { error: 'eventId, category, name, and slotType are required' },
        { status: 400 },
      );
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (slotType === 'LIMITED' && (!maxSignups || maxSignups < 1)) {
      return NextResponse.json(
        { error: 'maxSignups is required and must be at least 1 for LIMITED slots' },
        { status: 400 },
      );
    }

    const slot = await prisma.potluckSlot.create({
      data: {
        eventId,
        category,
        name: name.trim(),
        slotType,
        maxSignups: slotType === 'LIMITED' ? maxSignups : null,
        currentSignups: 0,
      },
    });

    return NextResponse.json(slot);
  } catch (error) {
    console.error('Failed to create potluck slot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
