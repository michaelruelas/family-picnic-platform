import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        rsvps: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        potluckSlots: {
          include: {
            _count: {
              select: { signups: true },
            },
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                household: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to fetch event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      date,
      location,
      description,
      rsvpDeadline,
      maxCapacity,
      mapImageUrl,
      registrationFeeCents,
      registrationFeeMinAge,
    } = body;

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (rsvpDeadline && new Date(rsvpDeadline) > new Date(date || existing.date)) {
      return NextResponse.json(
        { error: 'RSVP deadline must be before the event date' },
        { status: 400 },
      );
    }

    if (maxCapacity !== undefined && maxCapacity < 1) {
      return NextResponse.json({ error: 'maxCapacity must be at least 1' }, { status: 400 });
    }

    if (registrationFeeCents !== undefined && registrationFeeCents < 0) {
      return NextResponse.json(
        { error: 'registrationFeeCents must be at least 0' },
        { status: 400 },
      );
    }

    if (
      registrationFeeMinAge !== undefined &&
      (registrationFeeMinAge < 0 || registrationFeeMinAge > 120)
    ) {
      return NextResponse.json(
        { error: 'registrationFeeMinAge must be between 0 and 120' },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (date !== undefined) updateData.date = new Date(date);
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (rsvpDeadline !== undefined)
      updateData.rsvpDeadline = rsvpDeadline ? new Date(rsvpDeadline) : null;
    if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity || null;
    if (mapImageUrl !== undefined) updateData.mapImageUrl = mapImageUrl || null;
    if (registrationFeeCents !== undefined) updateData.registrationFeeCents = registrationFeeCents;
    if (registrationFeeMinAge !== undefined)
      updateData.registrationFeeMinAge = registrationFeeMinAge;

    const event = await prisma.event.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to update event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;

  try {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await prisma.event.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
