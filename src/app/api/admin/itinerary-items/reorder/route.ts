import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { itineraryItemReorderSchema } from '~/lib/schemas/itinerary';

// FPP-45 / QUB-31.2: drag-to-reorder persistence.
//
// The client posts the full ordered list of itinerary item ids for
// an event. The server rewrites the `order` column so the i-th id
// in the array gets `order = i`. Sending the full list (rather
// than a delta) keeps the contract simple and lets the server
// detect mismatches when an item was deleted in another tab.
export async function POST(request: Request) {
  // FPP-65 audit: per-event gate. A HOST with an EventAdmin row on
  // the target event can reorder the itinerary for their own
  // picnic; super-admins can reorder any event. The body is
  // parsed once and reused so the request stream is not consumed
  // twice.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const probe = itineraryItemReorderSchema.safeParse(body);
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

    const existing = await prisma.itineraryItem.findMany({
      where: { eventId: input.eventId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const incomingIds = new Set(input.itemIds);

    // The client must list every itinerary item exactly once. A
    // mismatch usually means the host deleted or added an item in
    // another tab between the load and the drop; refuse the write
    // rather than silently overwrite or drop rows.
    if (
      existingIds.size !== incomingIds.size ||
      !Array.from(existingIds).every((id) => incomingIds.has(id))
    ) {
      return NextResponse.json(
        { error: 'Itinerary item list is out of sync with the server. Reload and try again.' },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < input.itemIds.length; i += 1) {
        const itemId = input.itemIds[i];
        if (!itemId) continue;
        await tx.itineraryItem.update({
          where: { id: itemId },
          data: { order: i },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder itinerary items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
