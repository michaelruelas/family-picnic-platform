import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';

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
          description,
          rsvpDeadline,
          maxCapacity,
          mapImageUrl,
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

        const event = await prisma.event.create({
          data: {
            name,
            date: new Date(date),
            location,
            description: description || '',
            rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
            maxCapacity: maxCapacity || null,
            mapImageUrl: mapImageUrl || null,
            registrationFeeCents: registrationFeeCents ?? 0,
            registrationFeeMinAge: registrationFeeMinAge ?? 0,
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
