import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { writeAuditLog } from '~/lib/audit';
import { GooglePlacesError, resolvePlaceFromId } from '~/lib/google-maps';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-152: re-resolve an event's location from its stored
 * `placeId`. The Places API id is captured by every Google pick in
 * the admin form, but until now nothing read it back — so a host
 * whose pin drifted (Google improves geocoding, address was
 * re-mapped, etc.) had to delete and re-pick the address by hand.
 *
 * This route calls the Google Places Details API with the stored
 * placeId and writes the fresh `formattedAddress`, `lat`, and
 * `lng` back onto the event. `customLocationName` is left alone —
 * it is the host's free-form display label and is independent of
 * the resolved pin.
 *
 * Auth: per-event gate via `requireEventAdminApi`, so a HOST
 * with an EventAdmin row can refresh their own event. The
 * `event.re_resolve_location` audit entry captures the old/new
 * location + coords so the audit viewer can see who refreshed
 * what and when.
 *
 * Failure modes:
 *   - 400 when the event has no placeId stored (nothing to refresh)
 *   - 502 when the upstream Google call fails or returns missing fields
 *   - 503 when the API key is not configured (mirrors the public map gate)
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const auth = await requireEventAdminApi(id);
  if (!auth.ok) return auth.response;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.placeId) {
      return NextResponse.json(
        { error: 'Event has no placeId; pick a Google address first' },
        { status: 400 },
      );
    }

    const resolved = await resolvePlaceFromId(event.placeId);
    if (!resolved) {
      return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 503 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        location: resolved.location,
        lat: resolved.lat,
        lng: resolved.lng,
      },
    });

    await writeAuditLog({
      userId: auth.session.user.id,
      eventId: event.id,
      action: 'event.re_resolve_location',
      oldValue: {
        location: event.location,
        lat: event.lat,
        lng: event.lng,
      },
      newValue: {
        location: updated.location,
        lat: updated.lat,
        lng: updated.lng,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof GooglePlacesError) {
      console.error('Failed to re-resolve event location:', error);
      return NextResponse.json(
        { error: 'Failed to re-resolve location from Google' },
        { status: 502 },
      );
    }
    console.error('Failed to re-resolve event location:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
