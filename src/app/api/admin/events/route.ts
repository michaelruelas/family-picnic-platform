import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';

export async function GET() {
  const requestId = generateRequestId();
  const session = await getServerSession(authOptions);

  const log = createRequestLogger({
    requestId,
    userId: session?.user?.id,
    route: '/api/admin/events',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session?.user?.id, '/api/admin/events'),
    async () => {
      if (!session?.user?.id || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

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
  const session = await getServerSession(authOptions);

  const log = createRequestLogger({
    requestId,
    userId: session?.user?.id,
    route: '/api/admin/events',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session?.user?.id, '/api/admin/events'),
    async () => {
      if (!session?.user?.id || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const body = await request.json();
        const { name, date, location, description, rsvpDeadline, maxCapacity, mapImageUrl } = body;

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

        const event = await prisma.event.create({
          data: {
            name,
            date: new Date(date),
            location,
            description: description || '',
            rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
            maxCapacity: maxCapacity || null,
            mapImageUrl: mapImageUrl || null,
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
