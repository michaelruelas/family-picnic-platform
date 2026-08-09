import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { itineraryItemCreateSchema } from '~/lib/schemas/itinerary';

export async function POST(request: Request) {
  // FPP-65 audit: per-event gate. A HOST with an EventAdmin row on
  // the target event can curate the itinerary for their own
  // picnic; super-admins can curate any event. The input eventId
  // is parsed from the body once; the same parsed body is reused
  // for the schema gate and the actual handler so the request
  // body stream is not consumed twice.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const probe = itineraryItemCreateSchema.safeParse(body);
  if (!probe.success) {
    const firstError = probe.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? 'Invalid input' }, { status: 400 });
  }

  const auth = await requireEventAdminApi(probe.data.eventId);
  if (!auth.ok) return auth.response;
  void auth.session;

  try {
    const input = probe.data;

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
