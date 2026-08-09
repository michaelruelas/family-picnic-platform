import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { itineraryItemUpdateSchema } from '~/lib/schemas/itinerary';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Resolve the item id from the URL, look up its eventId, then run
 * `requireEventAdminApi`. Doing the lookup first means a HOST
 * without access to the event gets 403 / 404, not 401 (no
 * session). The auth check is the same regardless of which
 * mutation runs.
 */
async function authorizeRequest(id: string, request: Request) {
  const existing = await prisma.itineraryItem.findUnique({
    where: { id },
    select: { id: true, eventId: true },
  });
  if (!existing) return { kind: 'not-found' as const };
  const auth = await requireEventAdminApi(existing.eventId);
  if (!auth.ok) return { kind: 'denied' as const, response: auth.response };
  void request;
  return { kind: 'ok' as const, existing };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    // FPP-65 audit: schema gate runs BEFORE the auth check so a
    // malformed body returns 400 (not 401 / 403). The auth check
    // needs the item's eventId, which lives in the DB, so we
    // resolve the item first; the order is: schema validate →
    // body parse → item lookup → auth.
    const body = await request.json();
    const schemaCheck = itineraryItemUpdateSchema.safeParse({ ...body, id });
    if (!schemaCheck.success) {
      const firstError = schemaCheck.error.issues[0];
      return NextResponse.json({ error: firstError?.message ?? 'Invalid input' }, { status: 400 });
    }
    const input = schemaCheck.data;

    const auth = await authorizeRequest(id, request);
    if (auth.kind === 'not-found') {
      return NextResponse.json({ error: 'Itinerary item not found' }, { status: 404 });
    }
    if (auth.kind === 'denied') return auth.response;

    const data: { time?: string | null; title?: string; description?: string | null } = {};
    if (input.time !== undefined) {
      data.time = input.time === '' ? null : input.time;
    }
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;

    const updated = await prisma.itineraryItem.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update itinerary item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorizeRequest(id, _request);
    if (auth.kind === 'not-found') {
      return NextResponse.json({ error: 'Itinerary item not found' }, { status: 404 });
    }
    if (auth.kind === 'denied') return auth.response;

    const existing = auth.existing;
    if (!existing) {
      return NextResponse.json({ error: 'Itinerary item not found' }, { status: 404 });
    }

    // Re-pack the trailing `order` so the list stays contiguous
    // after the gap left by the delete.
    await prisma.$transaction(async (tx) => {
      await tx.itineraryItem.delete({ where: { id } });
      const remaining = await tx.itineraryItem.findMany({
        where: { eventId: existing.eventId },
        orderBy: { order: 'asc' },
        select: { id: true },
      });
      for (let i = 0; i < remaining.length; i += 1) {
        const item = remaining[i];
        if (!item) continue;
        await tx.itineraryItem.update({
          where: { id: item.id },
          data: { order: i },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete itinerary item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
