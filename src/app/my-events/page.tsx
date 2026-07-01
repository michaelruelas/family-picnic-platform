import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MyEventsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  const [upcomingRSVPs, pastRSVPs] = await Promise.all([
    prisma.rSVP.findMany({
      where: {
        userId,
        event: {
          date: { gte: new Date() },
        },
      },
      include: {
        event: {
          include: {
            potluckSlots: {
              include: {
                signups: {
                  where: {
                    rsvp: {
                      userId,
                    },
                  },
                },
              },
            },
          },
        },
        user: {
          include: {
            household: true,
          },
        },
        potluckSignups: {
          include: {
            slot: true,
          },
        },
      },
      orderBy: {
        event: {
          date: 'asc',
        },
      },
    }),
    prisma.rSVP.findMany({
      where: {
        userId,
        event: {
          date: { lt: new Date() },
        },
      },
      include: {
        event: {
          include: {
            potluckSlots: {
              select: { id: true },
            },
          },
        },
        user: {
          include: {
            household: true,
          },
        },
        potluckSignups: {
          include: {
            slot: true,
          },
        },
      },
      orderBy: {
        event: {
          date: 'desc',
        },
      },
    }),
  ]);

  const hasAnyRSVPs = upcomingRSVPs.length > 0 || pastRSVPs.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">My Events</h1>
      <p className="mt-2 text-stone-600">Track your event RSVPs and potluck signups</p>

      {!hasAnyRSVPs ? (
        <div className="mt-12 rounded-2xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">📋</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No RSVPs Yet</h2>
          <p className="mt-2 text-amber-700">
            You haven&apos;t responded to any events yet. Browse upcoming events to RSVP!
          </p>
          <Link
            href="/events"
            className="mt-6 inline-block rounded-lg bg-amber-700 px-6 py-3 text-white hover:bg-amber-900"
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <>
          {upcomingRSVPs.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-stone-800">Upcoming Events</h2>
              <div className="mt-4 space-y-4">
                {upcomingRSVPs.map((rsvp) => {
                  const eventDate = new Date(rsvp.event.date);
                  const hasPotluck = rsvp.event.potluckSlots.length > 0;
                  const userPotluckSignups = rsvp.potluckSignups || [];
                  return (
                    <Link
                      key={rsvp.id}
                      href={`/events/${rsvp.event.id}`}
                      className="block rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-semibold text-stone-900">
                              {rsvp.event.name}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                rsvp.status === 'CONFIRMED'
                                  ? 'bg-green-100 text-green-700'
                                  : rsvp.status === 'DECLINED'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {rsvp.status.charAt(0) + rsvp.status.slice(1).toLowerCase()}
                            </span>
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
                        </div>
                        <div className="flex flex-col items-end gap-1 text-sm">
                          <span>📍 {rsvp.event.location}</span>
                          <span>
                            {rsvp.status === 'CONFIRMED' && (
                              <span className="text-green-600">✓ {rsvp.headcount} attending</span>
                            )}
                            {rsvp.status === 'PENDING' && (
                              <span className="text-amber-600">⏳ Awaiting response</span>
                            )}
                            {rsvp.status === 'DECLINED' && (
                              <span className="text-red-600">✗ Not attending</span>
                            )}
                          </span>
                        </div>
                      </div>
                      {rsvp.dietaryNotes && (
                        <p className="mt-2 text-sm text-amber-600">🥗 {rsvp.dietaryNotes}</p>
                      )}
                      {hasPotluck && rsvp.status === 'CONFIRMED' && (
                        <p className="mt-2 text-sm text-stone-500">
                          {userPotluckSignups.length > 0 ? (
                            <>🍴 Bringing: {userPotluckSignups.map((s) => s.dishName).join(', ')}</>
                          ) : (
                            '🍴 Potluck available - sign up!'
                          )}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {pastRSVPs.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold text-stone-800">Past Events</h2>
              <div className="mt-4 space-y-4">
                {pastRSVPs.map((rsvp) => {
                  const eventDate = new Date(rsvp.event.date);
                  return (
                    <Link
                      key={rsvp.id}
                      href={`/events/${rsvp.event.id}`}
                      className="block rounded-xl bg-white p-6 opacity-80 shadow-sm transition-all hover:opacity-100 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-semibold text-stone-900">
                              {rsvp.event.name}
                            </h3>
                            <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                              Past
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                rsvp.status === 'CONFIRMED'
                                  ? 'bg-green-100 text-green-700'
                                  : rsvp.status === 'DECLINED'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {rsvp.status.charAt(0) + rsvp.status.slice(1).toLowerCase()}
                            </span>
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
                        </div>
                        <div className="flex flex-col items-end gap-1 text-sm text-stone-500">
                          <span>📍 {rsvp.event.location}</span>
                          {rsvp.status === 'CONFIRMED' && (
                            <span className="text-green-600">✓ {rsvp.headcount} attended</span>
                          )}
                        </div>
                      </div>
                      {rsvp.dietaryNotes && (
                        <p className="mt-2 text-sm text-amber-600">🥗 {rsvp.dietaryNotes}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <div className="mt-12 rounded-2xl bg-amber-100 p-8 text-center">
        <h2 className="text-xl font-semibold text-amber-900">Want to see more events?</h2>
        <p className="mt-2 text-amber-700">Browse all upcoming family gatherings.</p>
        <Link
          href="/events"
          className="mt-4 inline-block rounded-lg bg-amber-700 px-6 py-3 text-white hover:bg-amber-900"
        >
          View All Events
        </Link>
      </div>
    </main>
  );
}
