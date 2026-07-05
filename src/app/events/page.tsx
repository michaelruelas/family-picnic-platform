import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { BreatheSection } from '~/components/ui/BreatheSection';

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
        rsvps: { select: { status: true, headcount: true } },
        potluckSlots: { select: { id: true } },
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
        rsvps: { select: { status: true, headcount: true } },
        potluckSlots: { select: { id: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 md:py-20">
      <BreatheSection>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
          The full calendar
        </p>
        <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
          Events
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-lg">
          Gatherings, big and small — everything on the family calendar.
        </p>
      </BreatheSection>

      {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
        <BreatheSection>
          <div className="bg-sunlight/20 ring-sunlight/40 mt-14 rounded-3xl p-16 text-center ring-1">
            <div className="text-6xl">🌅</div>
            <h2 className="font-display text-foreground mt-6 text-3xl font-semibold">
              No events on the calendar
            </h2>
            <p className="text-muted-foreground mt-3">
              Check back soon — someone is probably planning something wonderful.
            </p>
          </div>
        </BreatheSection>
      ) : (
        <div className="mt-14 space-y-16">
          {upcomingEvents.length > 0 && (
            <section>
              <BreatheSection>
                <div className="flex items-end justify-between">
                  <h2 className="font-display text-foreground text-3xl font-medium tracking-tight">
                    Upcoming
                  </h2>
                  <p className="text-sage text-sm font-semibold">
                    {upcomingEvents.length} {upcomingEvents.length === 1 ? 'event' : 'events'}
                  </p>
                </div>
              </BreatheSection>
              <div className="mt-8 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event, idx) => {
                  const eventDate = new Date(event.date);
                  return (
                    <BreatheSection key={event.id} delay={idx * 60}>
                      <Link
                        href={`/events/${event.id}`}
                        className="group bg-card shadow-card ring-border/60 hover-lift block overflow-hidden rounded-3xl ring-1 transition-all duration-300"
                      >
                        <div className="bg-sage/15 relative aspect-[5/3] overflow-hidden">
                          {event.mapImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={event.mapImageUrl}
                              alt={event.name}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="from-sunlight/40 via-sage/20 to-terracotta/15 flex h-full w-full items-center justify-center bg-gradient-to-br">
                              <span className="text-5xl">🌳</span>
                            </div>
                          )}
                          <div className="bg-card/90 text-foreground shadow-soft absolute top-4 left-4 rounded-2xl px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                            {eventDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                        <div className="p-6">
                          <h3 className="font-display text-foreground text-2xl leading-tight font-medium">
                            {event.name}
                          </h3>
                          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
                            {event.description}
                          </p>
                          <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                            <span className="flex items-center gap-1.5">
                              <span className="text-sage">📍</span>
                              <span className="truncate">{event.location.split(',')[0]}</span>
                            </span>
                            {event.rsvps.filter((r) => r.status === 'CONFIRMED').length > 0 && (
                              <span className="flex items-center gap-1.5">
                                <span className="text-terracotta">👥</span>
                                {event.rsvps
                                  .filter((r) => r.status === 'CONFIRMED')
                                  .reduce((sum, r) => sum + r.headcount, 0)}{' '}
                                attending
                              </span>
                            )}
                            {event.potluckSlots.length > 0 && (
                              <span className="flex items-center gap-1.5">
                                <span>🍴</span>
                                {event.potluckSlots.length} dishes
                              </span>
                            )}
                          </div>
                          {event.rsvpDeadline && new Date(event.rsvpDeadline) > now && (
                            <div className="rounded-pill bg-sunlight/25 mt-4 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#a07c2f]">
                              <span>⏰</span> RSVP by{' '}
                              {new Date(event.rsvpDeadline).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          )}
                        </div>
                      </Link>
                    </BreatheSection>
                  );
                })}
              </div>
            </section>
          )}

          {pastEvents.length > 0 && (
            <section>
              <BreatheSection>
                <h2 className="font-display text-foreground text-3xl font-medium tracking-tight">
                  Past gatherings
                </h2>
              </BreatheSection>
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pastEvents.map((event, idx) => {
                  const eventDate = new Date(event.date);
                  return (
                    <BreatheSection key={event.id} delay={idx * 60}>
                      <Link
                        href={`/events/${event.id}`}
                        className="group bg-card shadow-card ring-border/60 hover-lift block overflow-hidden rounded-3xl opacity-80 ring-1 transition-all duration-300 hover:opacity-100"
                      >
                        <div className="bg-muted relative aspect-[5/3] overflow-hidden">
                          {event.mapImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={event.mapImageUrl}
                              alt={event.name}
                              className="h-full w-full object-cover grayscale transition-transform duration-700 group-hover:scale-105 group-hover:grayscale-0"
                            />
                          ) : (
                            <div className="from-sunlight/30 via-sage/15 to-terracotta/10 flex h-full w-full items-center justify-center bg-gradient-to-br">
                              <span className="text-5xl">🌳</span>
                            </div>
                          )}
                          <div className="rounded-pill bg-foreground/80 text-background absolute top-4 left-4 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                            Past
                          </div>
                        </div>
                        <div className="p-6">
                          <h3 className="font-display text-foreground text-xl leading-tight font-medium">
                            {event.name}
                          </h3>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {eventDate.toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </Link>
                    </BreatheSection>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
