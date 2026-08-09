import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { itineraryItemUpdateSchema } from '~/lib/schemas/itinerary';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;
  void session;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = itineraryItemUpdateSchema.safeParse({ ...body, id });
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return NextResponse.json({ error: firstError?.message ?? 'Invalid input' }, { status: 400 });
    }
    const input = parseResult.data;

    const existing = await prisma.itineraryItem.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Itinerary item not found' }, { status: 404 });
    }

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
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;
  void session;

  try {
    const { id } = await params;

    const existing = await prisma.itineraryItem.findUnique({
      where: { id },
      select: { id: true, eventId: true, order: true },
    });
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
