import { NextResponse } from 'next/server';
import { requireAdminApi, requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

// FPP-60: trust-boundary URL check. `new URL()` accepts `javascript:`
// and other dangerous schemes, so the helper additionally enforces an
// http(s) protocol. The Zod schema enforces the same rule via
// `.string().url()` but is only consulted by the client form.
function assertHttpUrl(value: string, fieldName: string): NextResponse | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return NextResponse.json({ error: `${fieldName} must be a valid URL` }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: `${fieldName} must be an http(s) URL` }, { status: 400 });
  }
  return null;
}

/**
 * FPP-104: GET is intentionally global-admin only. The host
 * surface is the dedicated event-edit page, which already routes
 * through `requireEventAdminPage` and ships the per-event payload
 * in the same Prisma call. Keeping GET on `requireAdminApi` stops
 * a host from enumerating every event by id via this route.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  void auth.session;

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

/**
 * FPP-104: per-event gate. Mirrors the tRPC `event.update`
 * procedure's move to `eventAdminProcedure` so a HOST can edit
 * their own event.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const auth = await requireEventAdminApi(id);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      name,
      date,
      location,
      lat,
      lng,
      placeId,
      description,
      rsvpDeadline,
      maxCapacity,
      mapImageUrl,
      featuredImageUrl,
      currency,
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

    // FPP-60: validate URL shape at the trust boundary. The Zod
    // schema has the same rule but is only consulted by the client
    // form; the REST surface is reachable directly. Empty string is
    // a clear request and collapses to null below.
    if (typeof featuredImageUrl === 'string' && featuredImageUrl !== '') {
      const err = assertHttpUrl(featuredImageUrl, 'featuredImageUrl');
      if (err) return err;
    }

    if (typeof mapImageUrl === 'string' && mapImageUrl !== '') {
      const err = assertHttpUrl(mapImageUrl, 'mapImageUrl');
      if (err) return err;
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (date !== undefined) updateData.date = new Date(date);
    if (location !== undefined) updateData.location = location;
    if (lat !== undefined) updateData.lat = lat;
    if (lng !== undefined) updateData.lng = lng;
    if (placeId !== undefined) updateData.placeId = placeId;
    if (description !== undefined) updateData.description = description;
    if (rsvpDeadline !== undefined)
      updateData.rsvpDeadline = rsvpDeadline ? new Date(rsvpDeadline) : null;
    if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity || null;
    if (mapImageUrl !== undefined) updateData.mapImageUrl = mapImageUrl || null;
    if (featuredImageUrl !== undefined) updateData.featuredImageUrl = featuredImageUrl || null;
    if (currency !== undefined) updateData.currency = currency;
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

/**
 * FPP-104: per-event gate. Mirrors the tRPC `event.delete` (which
 * remains platform-admin only) by routing through the per-event
 * gate so a HOST can remove their own event. The `event.delete`
 * tRPC proc is intentionally not changed in this ticket — REST is
 * a different surface with its own auth — but both paths now share
 * the per-event check.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const auth = await requireEventAdminApi(id);
  if (!auth.ok) return auth.response;

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
