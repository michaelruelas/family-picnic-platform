import { NextResponse } from 'next/server';
import { requireAdminApi, requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { validateHttpUrlFields } from '~/lib/url-validation';

type RouteParams = { params: Promise<{ id: string }> };

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
              // FPP-Postmortem: exclude soft-deleted signups from the
              // admin event payload.
              select: { signups: { where: { deletedAt: null } } },
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
      // FPP-145: optional host-defined location display name. Empty
      // string clears the field; omit leaves the existing value.
      customLocationName,
      lat,
      lng,
      placeId,
      description,
      additionalInfo,
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

    // FPP-60: validate URL fields at the trust boundary. The Zod
    // schema has the same rule but is only consulted by the client
    // form; the REST surface is reachable directly. Empty string is
    // a clear request and collapses to null below.
    const urlErr = validateHttpUrlFields(body, ['featuredImageUrl', 'mapImageUrl']);
    if (urlErr) return urlErr;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (date !== undefined) updateData.date = new Date(date);
    if (location !== undefined) updateData.location = location;
    // FPP-145: empty string clears the custom display name so the
    // public page falls back to the resolved Google address. Matches
    // the `additionalInfo` / `mapImageUrl` clear-by-empty pattern.
    if (customLocationName !== undefined) {
      updateData.customLocationName = customLocationName || null;
    }
    if (lat !== undefined) updateData.lat = lat;
    if (lng !== undefined) updateData.lng = lng;
    if (placeId !== undefined) updateData.placeId = placeId;
    if (description !== undefined) updateData.description = description;
    if (additionalInfo !== undefined) updateData.additionalInfo = additionalInfo || null;
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

    // FPP-Postmortem: the cascade from `event.delete` lands on every
    // PotluckSignup row for the event. The PotluckSignup_no_delete
    // trigger blocks direct DELETE statements, so we soft-delete the
    // live signups first, then opt in to the bypass flag for the
    // event delete itself. The cascade runs with the flag still set
    // and the trigger lets it through. Both the soft-delete and the
    // SET LOCAL / event.delete share one transaction so the bypass
    // scope is exactly the cascade chain.
    await prisma.$transaction(async (tx) => {
      await tx.potluckSignup.updateMany({
        where: { slot: { eventId: id }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.$executeRawUnsafe("SET LOCAL app.potluck_signup_allow_hard_delete = 'true'");
      await tx.event.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
