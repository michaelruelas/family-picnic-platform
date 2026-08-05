import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import Link from 'next/link';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS } from '~/lib/constants';
import { BreatheSection } from '~/components/ui/BreatheSection';
import { PotluckManageCard } from '~/components/potluck/PotluckManageCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventPotluckPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const isLoggedIn = !!userId;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      potluckSlots: {
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        include: {
          signups: {
            where: { rsvp: { status: 'CONFIRMED' } },
            orderBy: { id: 'asc' },
            include: {
              rsvp: {
                select: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      household: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const eventDate = new Date(event.date);
  const now = new Date();
  const isPast = eventDate < now;

  const userRsvp = userId
    ? await prisma.rSVP.findFirst({
        where: { eventId: id, userId },
        select: { id: true, status: true },
      })
    : null;

  const userSignupSlotIds = new Set<string>();
  if (userRsvp?.status === 'CONFIRMED') {
    const mySignups = await prisma.potluckSignup.findMany({
      where: { rsvpId: userRsvp.id },
      select: { slotId: true },
    });
    for (const s of mySignups) {
      userSignupSlotIds.add(s.slotId);
    }
  }

  const slotsByCategory = event.potluckSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.category]) {
        acc[slot.category] = [];
      }
      acc[slot.category]!.push(slot);
      return acc;
    },
    {} as Record<string, (typeof event.potluckSlots)[number][]>,
  );

  const totalDishes = event.potluckSlots.reduce((sum, slot) => sum + slot.signups.length, 0);
  const totalSlots = event.potluckSlots.length;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 md:py-20">
      <BreatheSection>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
          <Link href={`/events/${event.id}`} className="hover:text-foreground transition-colors">
            ← {event.name}
          </Link>
        </p>
        <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
          The Potluck
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-lg">
          {totalSlots === 0
            ? 'The menu is still being planned.'
            : `${totalDishes} ${totalDishes === 1 ? 'dish' : 'dishes'} claimed across ${totalSlots} ${totalSlots === 1 ? 'slot' : 'slots'}.`}
        </p>
      </BreatheSection>

      {isLoggedIn && userRsvp?.status === 'CONFIRMED' && !isPast && (
        <BreatheSection>
          <PotluckManageCard
            eventId={event.id}
            mySignupCount={userSignupSlotIds.size}
            hasOpenSlots={event.potluckSlots.some(
              (s) => s.slotType === 'UNLIMITED' || s.signups.length < (s.maxSignups ?? 0),
            )}
          />
        </BreatheSection>
      )}

      {event.potluckSlots.length === 0 ? (
        <BreatheSection>
          <div className="bg-sunlight/20 ring-sunlight/40 mt-10 rounded-3xl p-16 text-center ring-1">
            <div className="text-6xl">🍽️</div>
            <h2 className="font-display text-foreground mt-6 text-3xl font-semibold">
              The menu is still being planned
            </h2>
            <p className="text-muted-foreground mt-3">
              The organizer hasn&apos;t set up potluck categories for this event yet. Check back
              soon!
            </p>
          </div>
        </BreatheSection>
      ) : (
        <div className="mt-14 space-y-12">
          {Object.entries(slotsByCategory).map(([category, slots]) => {
            const dishes = slots.flatMap((slot) => slot.signups);
            const colorByCategory: Record<string, string> = {
              MAIN: 'bg-terracotta/15 text-terracotta',
              SIDE: 'bg-sage/20 text-sage',
              DESSERT: 'bg-sunlight/30 text-[#a07c2f]',
              DRINK: 'bg-secondary text-foreground',
              OTHER: 'bg-secondary text-muted-foreground',
            };
            const chipColor = colorByCategory[category] ?? 'bg-secondary text-foreground';

            return (
              <BreatheSection key={category}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <span
                      className={`rounded-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold tracking-wider uppercase ${chipColor}`}
                    >
                      <span>{POTLUCK_CATEGORY_EMOJIS[category] || '📦'}</span>
                      {POTLUCK_CATEGORY_LABELS[category] || category}
                    </span>
                    <h2 className="font-display text-foreground mt-3 text-3xl font-medium tracking-tight">
                      {slots.length} {slots.length === 1 ? 'slot' : 'slots'}
                    </h2>
                  </div>
                  <p className="text-sage text-sm font-semibold">
                    {dishes.length} {dishes.length === 1 ? 'dish' : 'dishes'} claimed
                  </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {slots.map((slot) => {
                    const isFull =
                      slot.slotType === 'LIMITED' && slot.signups.length >= (slot.maxSignups ?? 0);
                    return (
                      <div
                        key={slot.id}
                        className="bg-card shadow-card ring-border/60 rounded-2xl p-5 ring-1"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-display text-foreground text-lg font-semibold">
                            {slot.name}
                          </h3>
                          <span
                            className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                              isFull ? 'bg-secondary text-muted-foreground' : 'bg-sage/20 text-sage'
                            }`}
                          >
                            {slot.slotType === 'UNLIMITED'
                              ? 'Open'
                              : `${slot.signups.length} / ${slot.maxSignups}`}
                          </span>
                        </div>
                        {slot.signups.length === 0 ? (
                          <p className="text-muted-foreground mt-3 text-sm italic">
                            We could use a hand here — want to bring something?
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {slot.signups.map((dish) => (
                              <li
                                key={dish.id}
                                className="border-border/60 flex items-baseline justify-between gap-3 border-t pt-2 text-sm first:border-t-0 first:pt-0"
                              >
                                <span className="text-foreground font-medium">{dish.dishName}</span>
                                <span className="text-muted-foreground text-xs">
                                  {dish.servings > 1 ? `${dish.servings} servings · ` : ''}
                                  {dish.rsvp.user?.household?.name ||
                                    dish.rsvp.user?.name ||
                                    'A friend'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </BreatheSection>
            );
          })}
        </div>
      )}
    </main>
  );
}
