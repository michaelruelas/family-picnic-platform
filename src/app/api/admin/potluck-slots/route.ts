import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { PotluckCategory, SlotType } from '~/lib/generated/enums';

/**
 * FPP-104: per-event gate. A HOST with an EventAdmin row for the
 * event can curate the potluck slots for their own picnic; super-
 * admins can curate any event. Mirrors the tRPC `potluck.createSlot`
 * procedure's move to `eventAdminProcedure`.
 */
export async function POST(request: Request) {
  let body: {
    eventId?: string;
    category?: string;
    name?: string;
    slotType?: string;
    maxSignups?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { eventId, category, name, slotType, maxSignups } = body;

  if (!eventId || !category || !slotType) {
    return NextResponse.json(
      { error: 'eventId, category, and slotType are required' },
      { status: 400 },
    );
  }

  const auth = await requireEventAdminApi(eventId);
  if (!auth.ok) return auth.response;

  try {
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

    const trimmedName = typeof name === 'string' ? name.trim() : null;
    if (name !== undefined && trimmedName === null) {
      return NextResponse.json({ error: 'name must be a string if provided' }, { status: 400 });
    }
    const slot = await prisma.potluckSlot.create({
      data: {
        eventId,
        category: category as PotluckCategory,
        name: trimmedName === '' ? null : trimmedName,
        slotType: slotType as SlotType,
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
