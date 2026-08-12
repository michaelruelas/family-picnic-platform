import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';
import { toEventCreateData } from '~/lib/event-data';

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

export async function GET() {
  const requestId = generateRequestId();
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const log = createRequestLogger({
    requestId,
    userId: session.user.id,
    route: '/api/admin/events',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session.user.id, '/api/admin/events'),
    async () => {
      try {
        const events = await prisma.event.findMany({
          orderBy: { date: 'desc' },
          include: {
            _count: {
              select: {
                rsvps: true,
                potluckSlots: true,
              },
            },
          },
        });

        return NextResponse.json(events);
      } catch (error) {
        log.error({ err: error }, 'Failed to fetch events');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  );
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const log = createRequestLogger({
    requestId,
    userId: session.user.id,
    route: '/api/admin/events',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session.user.id, '/api/admin/events'),
    async () => {
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

        if (!name || !date || !location) {
          return NextResponse.json(
            { error: 'name, date, and location are required' },
            { status: 400 },
          );
        }

        if (rsvpDeadline && new Date(rsvpDeadline) > new Date(date)) {
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

        // FPP-60: validate URL shape at the trust boundary so an
        // `javascript:` or otherwise malformed payload cannot land
        // in the column. Empty string is treated as "no image" and
        // collapses to null below via `toEventCreateData`. The Zod
        // schema has the same rule but is only consulted by the
        // client form; the REST surface is reachable directly.
        if (typeof featuredImageUrl === 'string' && featuredImageUrl !== '') {
          const err = assertHttpUrl(featuredImageUrl, 'featuredImageUrl');
          if (err) return err;
        }

        if (typeof mapImageUrl === 'string' && mapImageUrl !== '') {
          const err = assertHttpUrl(mapImageUrl, 'mapImageUrl');
          if (err) return err;
        }

        const event = await prisma.event.create({
          data: {
            ...toEventCreateData({
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
            }),
            status: EventStatus.DRAFT,
          },
        });

        return NextResponse.json(event);
      } catch (error) {
        log.error({ err: error }, 'Failed to create event');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  );
}
