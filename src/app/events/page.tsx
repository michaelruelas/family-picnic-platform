import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const now = new Date();

  const [upcomingEvents, pastEvents] = await Promise.all([
    prisma.event.findMany({
      where: { status: 'PUBLISHED', date: { gte: now } },
      orderBy: { date: 'asc' },
      take: 10,
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        description: true,
        mapImageUrl: true,
        rsvpDeadline: true,
        status: true,
        rsvps: {
          select: {
            status: true,
            headcount: true,
          },
        },
        potluckSlots: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.event.findMany({
      where: { status: 'PUBLISHED', date: { lt: now } },
      orderBy: { date: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        description: true,
        mapImageUrl: true,
        rsvpDeadline: true,
        status: true,
        rsvps: {
          select: {
            status: true,
            headcount: true,
          },
        },
        potluckSlots: {
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Events</h1>
      <p className="mt-2 text-stone-600">Join our family gatherings and make lasting memories</p>

      {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No Events Yet</h2>
          <p className="mt-2 text-amber-700">Check back soon for our next family gathering!</p>
        </div>
      ) : (
        <>
          {upcomingEvents.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-stone-800">Upcoming Events</h2>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {upcomingEvents.map((event) => {
                  const eventDate = new Date(event.date);
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-semibold text-stone-900">{event.name}</h3>
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
                            </div>
                          </div>
                          <p className="mt-3 line-clamp-2 text-stone-600">{event.description}</p>
                        </div>
                        {event.mapImageUrl && (
                          <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
                            <Image
                              src={event.mapImageUrl}
                              alt={`Map for ${event.location}`}
                              fill
                              className="object-cover"
                              sizes="128px"
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-500">
                        <span>📍 {event.location}</span>
                        {event.rsvps.length > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="text-green-600">✓</span>
                            <span>
                              {event.rsvps
                                .filter((r) => r.status === 'CONFIRMED')
                                .reduce((sum, r) => sum + r.headcount, 0)}{' '}
                              attending
                            </span>
                          </span>
                        )}
                        {event.potluckSlots.length > 0 && (
                          <span className="flex items-center gap-1">
                            <span>🍴</span>
                            <span>{event.potluckSlots.length} potluck slots</span>
                          </span>
                        )}
                        {event.rsvpDeadline && new Date(event.rsvpDeadline) > now && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <span>⏰</span>
                            <span>
                              RSVP by{' '}
                              {new Date(event.rsvpDeadline).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {pastEvents.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold text-stone-800">Past Events</h2>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {pastEvents.map((event) => {
                  const eventDate = new Date(event.date);
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block rounded-xl bg-white p-6 opacity-80 shadow-sm transition-shadow hover:opacity-100 hover:shadow-md"
                    >
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-semibold text-stone-900">{event.name}</h3>
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
                            </div>
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                              Past
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-2 text-stone-600">{event.description}</p>
                        </div>
                        {event.mapImageUrl && (
                          <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100 opacity-60">
                            <Image
                              src={event.mapImageUrl}
                              alt={`Map for ${event.location}`}
                              fill
                              className="object-cover"
                              sizes="128px"
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-500">
                        <span>📍 {event.location}</span>
                        {event.rsvps.length > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="text-green-600">✓</span>
                            <span>
                              {event.rsvps
                                .filter((r) => r.status === 'CONFIRMED')
                                .reduce((sum, r) => sum + r.headcount, 0)}{' '}
                              attended
                            </span>
                          </span>
                        )}
                        {event.potluckSlots.length > 0 && (
                          <span className="flex items-center gap-1">
                            <span>🍴</span>
                            <span>{event.potluckSlots.length} potluck slots</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <div className="mt-12 rounded-2xl bg-amber-100 p-8 text-center">
        <h2 className="text-xl font-semibold text-amber-900">Want to organize an event?</h2>
        <p className="mt-2 text-amber-700">Contact an admin to create a new family gathering.</p>
      </div>
    </main>
  );
}
