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
            potluckSlots: true,
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
      <h1 className="text-foreground text-3xl font-bold">My Events</h1>
      <p className="text-muted-foreground mt-2">Track your event RSVPs and potluck signups</p>

      {!hasAnyRSVPs ? (
        <div className="bg-sunlight/20 mt-12 rounded-2xl p-8 text-center">
          <div className="text-5xl">📋</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No RSVPs Yet</h2>
          <p className="text-terracotta mt-2">
            You haven&apos;t responded to any events yet. Browse upcoming events to RSVP!
          </p>
          <Link
            href="/events"
            className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-lg px-6 py-3 text-white"
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <>
          {upcomingRSVPs.length > 0 && (
            <section className="mt-8">
              <h2 className="text-foreground text-xl font-semibold">Upcoming Events</h2>
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
                            <h3 className="text-foreground text-xl font-semibold">
                              {rsvp.event.name}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                rsvp.status === 'CONFIRMED'
                                  ? 'bg-sage/20 text-sage'
                                  : rsvp.status === 'DECLINED'
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-terracotta/15 text-terracotta'
                              }`}
                            >
                              {rsvp.status.charAt(0) + rsvp.status.slice(1).toLowerCase()}
                            </span>
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
                        </div>
                        <div className="flex flex-col items-end gap-1 text-sm">
                          <span>📍 {rsvp.event.location}</span>
                          <span>
                            {rsvp.status === 'CONFIRMED' && (
                              <span className="text-sage">✓ {rsvp.headcount} attending</span>
                            )}
                            {rsvp.status === 'PENDING' && (
                              <span className="text-terracotta">⏳ Awaiting response</span>
                            )}
                            {rsvp.status === 'DECLINED' && (
                              <span className="text-destructive">✗ Not attending</span>
                            )}
                          </span>
                        </div>
                      </div>
                      {rsvp.dietaryNotes && (
                        <p className="text-terracotta mt-2 text-sm">🥗 {rsvp.dietaryNotes}</p>
                      )}
                      {hasPotluck && rsvp.status === 'CONFIRMED' && (
                        <p className="text-muted-foreground mt-2 text-sm">
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
              <h2 className="text-foreground text-xl font-semibold">Past Events</h2>
              <div className="mt-4 space-y-4">
                {pastRSVPs.map((rsvp) => {
                  const eventDate = new Date(rsvp.event.date);
                  const hasPotluck = rsvp.event.potluckSlots.length > 0;
                  const userPotluckSignups = rsvp.potluckSignups || [];
                  return (
                    <Link
                      key={rsvp.id}
                      href={`/events/${rsvp.event.id}`}
                      className="block rounded-xl bg-white p-6 opacity-80 shadow-sm transition-all hover:opacity-100 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-foreground text-xl font-semibold">
                              {rsvp.event.name}
                            </h3>
                            <span className="bg-secondary text-muted-foreground rounded-full px-2 py-1 text-xs">
                              Past
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                rsvp.status === 'CONFIRMED'
                                  ? 'bg-sage/20 text-sage'
                                  : rsvp.status === 'DECLINED'
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-terracotta/15 text-terracotta'
                              }`}
                            >
                              {rsvp.status.charAt(0) + rsvp.status.slice(1).toLowerCase()}
                            </span>
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
                        </div>
                        <div className="text-muted-foreground flex flex-col items-end gap-1 text-sm">
                          <span>📍 {rsvp.event.location}</span>
                          {rsvp.status === 'CONFIRMED' && (
                            <span className="text-sage">✓ {rsvp.headcount} attended</span>
                          )}
                        </div>
                      </div>
                      {rsvp.dietaryNotes && (
                        <p className="text-terracotta mt-2 text-sm">🥗 {rsvp.dietaryNotes}</p>
                      )}
                      {hasPotluck && rsvp.status === 'CONFIRMED' && (
                        <p className="text-muted-foreground mt-2 text-sm">
                          {userPotluckSignups.length > 0 ? (
                            <>🍴 Brought: {userPotluckSignups.map((s) => s.dishName).join(', ')}</>
                          ) : (
                            '🍴 Potluck event (no signup)'
                          )}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <div className="bg-terracotta/15 mt-12 rounded-2xl p-8 text-center">
        <h2 className="text-foreground text-xl font-semibold">Want to see more events?</h2>
        <p className="text-terracotta mt-2">Browse all upcoming family gatherings.</p>
        <Link
          href="/events"
          className="bg-terracotta hover:bg-terracotta mt-4 inline-block rounded-lg px-6 py-3 text-white"
        >
          View All Events
        </Link>
      </div>
    </main>
  );
}
