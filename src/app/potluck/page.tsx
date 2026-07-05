import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS } from '~/lib/constants';
import { BreatheSection } from '~/components/ui/BreatheSection';

export const dynamic = 'force-dynamic';

export default async function PotluckPage() {
  const eventsWithPotlucks = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      potluckSlots: {
        some: {},
      },
    },
    include: {
      potluckSlots: {
        select: {
          id: true,
          category: true,
          name: true,
          slotType: true,
          maxSignups: true,
          currentSignups: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  const now = new Date();

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 md:py-20">
      <BreatheSection>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
          Coordination
        </p>
        <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
          The Potluck
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-lg">
          See what everyone is bringing and claim an open dish.
        </p>
      </BreatheSection>

      {eventsWithPotlucks.length === 0 ? (
        <BreatheSection>
          <div className="bg-sunlight/20 ring-sunlight/40 mt-14 rounded-3xl p-16 text-center ring-1">
            <div className="text-6xl">🍽️</div>
            <h2 className="font-display text-foreground mt-6 text-3xl font-semibold">
              No potluck events yet
            </h2>
            <p className="text-muted-foreground mt-3">
              Check back soon when an event organizer sets up the menu.
            </p>
          </div>
        </BreatheSection>
      ) : (
        <div className="mt-14 grid gap-7 md:grid-cols-2">
          {eventsWithPotlucks.map((event, idx) => {
            const eventDate = new Date(event.date);
            const isPast = eventDate < now;
            const slotsByCategory = event.potluckSlots.reduce(
              (acc, slot) => {
                if (!acc[slot.category]) {
                  acc[slot.category] = [];
                }
                acc[slot.category]!.push(slot);
                return acc;
              },
              {} as Record<string, typeof event.potluckSlots>,
            );

            return (
              <BreatheSection key={event.id} delay={idx * 80}>
                <div
                  className={`bg-card shadow-card ring-border/60 hover-lift rounded-3xl p-7 ring-1 transition-all duration-300 ${isPast ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-foreground text-2xl font-medium">
                        {event.name}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {eventDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                        <span className="text-sage">📍</span>
                        <span>{event.location.split(',')[0]}</span>
                      </p>
                    </div>
                    {isPast && (
                      <span className="rounded-pill bg-secondary text-muted-foreground px-3 py-1 text-xs font-semibold">
                        Past
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {Object.entries(slotsByCategory).map(([category, slots]) => (
                      <span
                        key={category}
                        className="rounded-pill bg-secondary text-foreground inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                      >
                        <span>{POTLUCK_CATEGORY_EMOJIS[category] || '📦'}</span>
                        {POTLUCK_CATEGORY_LABELS[category] || category}: {slots.length}
                      </span>
                    ))}
                  </div>

                  <Link
                    href={`/events/${event.id}`}
                    className="rounded-pill bg-foreground text-background press hover:bg-foreground/90 mt-6 block w-full px-5 py-3 text-center text-sm font-semibold transition-all"
                  >
                    {isPast ? 'View Details' : 'Sign Up for Dishes'}
                  </Link>
                </div>
              </BreatheSection>
            );
          })}
        </div>
      )}
    </main>
  );
}
