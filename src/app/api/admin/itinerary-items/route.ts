import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { itineraryItemCreateSchema } from '~/lib/schemas/itinerary';

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;
  void session;

  try {
    const body = await request.json();
    const parseResult = itineraryItemCreateSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return NextResponse.json({ error: firstError?.message ?? 'Invalid input' }, { status: 400 });
    }
    const input = parseResult.data;

    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Append the new item at the end of the list.
    const maxOrder = await prisma.itineraryItem.aggregate({
      where: { eventId: input.eventId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const created = await prisma.itineraryItem.create({
      data: {
        eventId: input.eventId,
        time: input.time,
        title: input.title,
        description: input.description,
        order: nextOrder,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Failed to create itinerary item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
