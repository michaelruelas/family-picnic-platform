import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import EventActions from '~/components/admin/EventActions';

export const dynamic = 'force-dynamic';

async function getEvents() {
  return prisma.event.findMany({
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
}

export default async function AdminEventsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const events = await getEvents();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold">Admin: Events</h1>
          <p className="text-muted-foreground mt-2">Manage family picnic events</p>
        </div>
        <Link
          href="/admin/events/new"
          className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 font-medium text-white"
        >
          + New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-secondary rounded-2xl p-12 text-center">
          <div className="text-5xl">📅</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No Events Yet</h2>
          <p className="text-muted-foreground mt-2">Create your first event to get started.</p>
          <Link
            href="/admin/events/new"
            className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-lg px-6 py-2 font-medium text-white"
          >
            Create First Event
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const eventDate = new Date(event.date);

            return (
              <div
                key={event.id}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-foreground text-xl font-semibold">{event.name}</h3>
                      <EventStatusBadge status={event.status} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {eventDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}{' '}
                      at{' '}
                      {eventDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-muted-foreground mt-1">📍 {event.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <EventActions eventId={event.id} status={event.status} />
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-3 py-1 text-sm font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                </div>

                <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-6 text-sm">
                  <span>
                    <strong className="text-foreground/85">{event._count.rsvps}</strong> RSVPs
                  </span>
                  <span>
                    <strong className="text-foreground/85">{event._count.potluckSlots}</strong>{' '}
                    Potluck Slots
                  </span>
                  {event.maxCapacity && (
                    <span>
                      <strong className="text-foreground/85">{event.maxCapacity}</strong> max
                      capacity
                    </span>
                  )}
                  {event.rsvpDeadline && (
                    <span className="text-terracotta">
                      RSVP by{' '}
                      {new Date(event.rsvpDeadline).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
