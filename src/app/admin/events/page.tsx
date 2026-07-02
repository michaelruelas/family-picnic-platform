import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import EventStatusBadge from '~/components/event/EventStatusBadge';

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
          <h1 className="text-3xl font-bold text-stone-900">Admin: Events</h1>
          <p className="mt-2 text-stone-600">Manage family picnic events</p>
        </div>
        <Link
          href="/admin/events/new"
          className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
        >
          + New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl bg-stone-100 p-12 text-center">
          <div className="text-5xl">📅</div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">No Events Yet</h2>
          <p className="mt-2 text-stone-600">Create your first event to get started.</p>
          <Link
            href="/admin/events/new"
            className="mt-6 inline-block rounded-lg bg-amber-600 px-6 py-2 font-medium text-white hover:bg-amber-700"
          >
            Create First Event
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const eventDate = new Date(event.date);
            const isPast = eventDate < new Date();

            return (
              <div
                key={event.id}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-stone-900">{event.name}</h3>
                      <EventStatusBadge status={event.status} />
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
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
                    <p className="mt-1 text-stone-600">📍 {event.location}</p>
                  </div>
                  <div className="flex gap-2">
                    {event.status === 'DRAFT' && (
                      <form action={`/api/admin/events/${event.id}/publish`} method="POST">
                        <button
                          type="submit"
                          className="rounded-lg bg-green-100 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-200"
                        >
                          Publish
                        </button>
                      </form>
                    )}
                    {event.status === 'PUBLISHED' && (
                      <form action={`/api/admin/events/${event.id}/close`} method="POST">
                        <button
                          type="submit"
                          className="rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
                        >
                          Close RSVPs
                        </button>
                      </form>
                    )}
                    {event.status !== 'CLOSED' && event.status !== 'CANCELLED' && (
                      <form action={`/api/admin/events/${event.id}/cancel`} method="POST">
                        <button
                          type="submit"
                          className="rounded-lg bg-stone-100 px-3 py-1 text-sm font-medium text-stone-700 hover:bg-stone-200"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-200"
                    >
                      Edit
                    </Link>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-stone-500">
                  <span>
                    <strong className="text-stone-700">{event._count.rsvps}</strong> RSVPs
                  </span>
                  <span>
                    <strong className="text-stone-700">{event._count.potluckSlots}</strong> Potluck
                    Slots
                  </span>
                  {event.maxCapacity && (
                    <span>
                      <strong className="text-stone-700">{event.maxCapacity}</strong> max capacity
                    </span>
                  )}
                  {event.rsvpDeadline && (
                    <span className="text-amber-600">
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
