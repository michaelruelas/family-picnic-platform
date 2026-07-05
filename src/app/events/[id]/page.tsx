import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import PhotoCard from '~/components/PhotoCard';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS } from '~/lib/constants';
import { EventRsvpCard } from '~/components/event/EventRsvpCard';
import { EventStickyBar } from '~/components/event/EventStickyBar';
import { SignInPrompt } from '~/components/event/SignInPrompt';
import { BreatheSection } from '~/components/ui/BreatheSection';
import type { RSVPStatus } from '~/lib/generated/enums';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

type PublicPotluckSignup = {
  id: string;
  dishName: string;
  servings: number;
};

type PrivatePotluckSignup = PublicPotluckSignup & {
  rsvp: {
    user: { name: string | null; household: { name: string } | null } | null;
  };
};

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user?.id;
  const userId = session?.user?.id ?? null;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      potluckSlots: {
        orderBy: { category: 'asc' },
        include: {
          signups: {
            where: { rsvp: { status: 'CONFIRMED' } },
            orderBy: { id: 'asc' },
            include: {
              rsvp: {
                select: {
                  user: {
                    select: {
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
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          reactions: {
            select: { reaction: true, userId: true },
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

  const [confirmedHeadcount, pendingInvitationCount, userRsvp, pendingInvitations, userRole] =
    await Promise.all([
      prisma.rSVP
        .aggregate({
          where: { eventId: id, status: 'CONFIRMED' },
          _sum: { headcount: true },
        })
        .then((res) => res._sum.headcount ?? 0),
      prisma.invitation.count({
        where: {
          eventId: id,
          status: { in: ['SENT', 'DELIVERED'] },
        },
      }),
      userId
        ? prisma.rSVP.findFirst({
            where: { eventId: id, userId },
            select: {
              status: true,
              headcount: true,
              dietaryNotes: true,
              waitlistPosition: true,
            },
          })
        : Promise.resolve(null),
      userId
        ? prisma.invitation.findMany({
            where: {
              eventId: id,
              status: { in: ['SENT', 'DELIVERED'] },
            },
            select: {
              id: true,
              status: true,
              user: { select: { name: true } },
              household: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      userId
        ? prisma.user
            .findUnique({ where: { id: userId }, select: { role: true } })
            .then((u) => u?.role)
        : Promise.resolve(undefined),
    ]);

  const totalAttending = confirmedHeadcount;

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

  const totalPotluckDishes = event.potluckSlots.reduce((sum, slot) => sum + slot.signups.length, 0);

  const existingRsvpForCard = userRsvp
    ? {
        status: userRsvp.status as RSVPStatus,
        headcount: userRsvp.headcount,
        dietaryNotes: userRsvp.dietaryNotes,
      }
    : null;

  return (
    <main className="bg-background pb-32">
      <BreatheSection className="relative h-[55vh] min-h-[420px] w-full overflow-hidden md:h-[60vh]">
        {event.mapImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.mapImageUrl} alt={event.name} className="h-full w-full object-cover" />
        ) : (
          <div className="from-sunlight/40 via-sage/20 to-terracotta/15 h-full w-full bg-gradient-to-br" />
        )}
        <div className="from-foreground/40 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
        <div className="absolute top-5 right-5 left-5 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-pill shadow-soft inline-flex items-center gap-2 border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
            <span className="bg-sunlight h-2 w-2 rounded-full shadow-[0_0_10px_#f2cc8f]" />
            {event.status === 'PUBLISHED'
              ? 'Invitation Open'
              : event.status === 'CANCELLED'
                ? 'Cancelled'
                : event.status.charAt(0) + event.status.slice(1).toLowerCase()}
          </div>
          {isPast && (
            <div className="rounded-pill bg-foreground/80 text-background px-4 py-2 text-sm font-medium backdrop-blur-md">
              Past gathering
            </div>
          )}
        </div>
        <div className="absolute right-5 bottom-5 left-5 md:right-10 md:bottom-10 md:left-10">
          <div className="max-w-3xl">
            <p className="font-display text-base font-medium text-white/90 italic">
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <h1 className="font-display mt-2 text-4xl leading-[1.05] font-medium tracking-tight text-white drop-shadow-sm md:text-6xl">
              {event.name}
            </h1>
          </div>
        </div>
      </BreatheSection>

      <div className="mx-auto max-w-6xl px-5 pt-10 md:pt-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-12">
            <BreatheSection>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="flex items-center gap-2 text-base">
                  <span className="text-sage">📍</span>
                  <span className="text-foreground font-medium">{event.location}</span>
                </span>
                <span className="text-border hidden sm:inline">·</span>
                <span className="flex items-center gap-2 text-base">
                  <span className="text-terracotta">🕒</span>
                  {eventDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-border hidden sm:inline">·</span>
                <span className="flex items-center gap-2 text-base">
                  <span className="text-sage">👥</span>
                  {totalAttending} attending
                </span>
                {totalPotluckDishes > 0 && (
                  <>
                    <span className="text-border hidden sm:inline">·</span>
                    <span className="flex items-center gap-2 text-base">
                      <span className="text-terracotta">🍴</span>
                      {totalPotluckDishes} {totalPotluckDishes === 1 ? 'dish' : 'dishes'} claimed
                    </span>
                  </>
                )}
              </div>
            </BreatheSection>

            <BreatheSection>
              <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
                <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                  The welcome
                </p>
                <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
                  A note from the host
                </h2>
                <p className="text-foreground/80 mt-5 text-lg leading-relaxed">
                  {event.description}
                </p>
                {event.maxCapacity && (
                  <div className="bg-sunlight/20 text-foreground ring-sunlight/40 mt-6 rounded-2xl px-5 py-4 text-sm ring-1">
                    <span className="font-semibold">Heads up:</span> We can host up to{' '}
                    {event.maxCapacity} people. Reserve your spot early.
                  </div>
                )}
                {event.rsvpDeadline && new Date(event.rsvpDeadline) > now && (
                  <p className="text-muted-foreground mt-3 text-sm">
                    Please RSVP by{' '}
                    <span className="text-foreground font-semibold">
                      {new Date(event.rsvpDeadline).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    .
                  </p>
                )}
              </div>
            </BreatheSection>

            {isLoggedIn && pendingInvitations.length > 0 && (
              <BreatheSection>
                <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
                  <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                    Awaiting replies
                  </p>
                  <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight">
                    Pending invitations
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    These guests have been invited but haven&apos;t responded yet
                  </p>
                  <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                    {pendingInvitations.map((inv) => (
                      <li
                        key={inv.id}
                        className="bg-secondary flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
                      >
                        <span className="text-sunlight">⏳</span>
                        <span className="text-foreground font-medium">
                          {inv.household?.name || inv.user?.name || 'Unknown'}
                        </span>
                        {inv.status === 'SENT' && (
                          <span className="text-muted-foreground ml-auto text-xs">sent</span>
                        )}
                        {inv.status === 'DELIVERED' && (
                          <span className="text-muted-foreground ml-auto text-xs">delivered</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </BreatheSection>
            )}

            {!isLoggedIn && pendingInvitationCount > 0 && (
              <BreatheSection>
                <SignInPrompt
                  title={`${pendingInvitationCount} ${
                    pendingInvitationCount === 1 ? 'household is' : 'households are'
                  } still deciding`}
                  description="Sign in to see who has been invited and which families are still working out their plans."
                />
              </BreatheSection>
            )}

            <BreatheSection>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                    The menu
                  </p>
                  <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
                    The Potluck
                  </h2>
                </div>
                <p className="text-sage text-sm font-semibold">
                  {totalPotluckDishes} {totalPotluckDishes === 1 ? 'dish' : 'dishes'} claimed
                </p>
              </div>

              {event.potluckSlots.length === 0 ? (
                <div className="bg-sunlight/20 ring-sunlight/40 mt-6 rounded-3xl p-12 text-center ring-1">
                  <div className="text-5xl">🍽️</div>
                  <h3 className="font-display text-foreground mt-4 text-2xl font-semibold">
                    The menu is still being planned
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    The organizer hasn&apos;t set up potluck categories for this event yet. Check
                    back soon!
                  </p>
                </div>
              ) : (
                <div className="no-scrollbar -mx-5 mt-6 overflow-x-auto px-5 pb-2">
                  <div className="flex gap-4">
                    {isLoggedIn &&
                      userRsvp?.status === 'CONFIRMED' &&
                      (() => {
                        const openSlots = event.potluckSlots.filter(
                          (s) => s.signups.length === 0 || s.slotType === 'UNLIMITED',
                        );
                        if (openSlots.length === 0) return null;
                        return (
                          <AddDishCard
                            eventId={event.id}
                            existingCategories={Object.keys(slotsByCategory)}
                          />
                        );
                      })()}
                    {Object.entries(slotsByCategory).map(([category, slots]) => {
                      const dishes = slots.flatMap((slot) => slot.signups).slice(0, 4);
                      return (
                        <PotluckCategoryCard
                          key={category}
                          category={category}
                          dishes={dishes}
                          totalSlots={slots.length}
                          isLoggedIn={isLoggedIn}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </BreatheSection>

            <BreatheSection>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                    The day
                  </p>
                  <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
                    Itinerary
                  </h2>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  {
                    time: '10:00 AM',
                    title: 'Setup & Early Arrival',
                    desc: 'Unloading coolers and firing up the grill.',
                  },
                  {
                    time: '12:30 PM',
                    title: 'The Big Feast',
                    desc: 'Potluck lines open. Elders served first.',
                  },
                  {
                    time: '2:00 PM',
                    title: 'Family Games',
                    desc: 'Annual relay races and water balloons.',
                  },
                  {
                    time: '4:00 PM',
                    title: 'Golden Hour Photos',
                    desc: 'Find the cousins. Find the shade. Smile.',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-card shadow-card ring-border/60 flex items-center gap-5 rounded-2xl p-5 ring-1"
                  >
                    <div className="bg-sage/15 flex shrink-0 flex-col items-center justify-center rounded-2xl px-4 py-3 text-center">
                      <span className="font-display text-foreground text-lg font-semibold">
                        {item.time.split(' ')[0]}
                      </span>
                      <span className="text-muted-foreground text-xs font-semibold">
                        {item.time.split(' ')[1]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-foreground text-lg font-semibold">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </BreatheSection>

            <BreatheSection>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                    Captured moments
                  </p>
                  <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
                    Photos
                  </h2>
                </div>
              </div>
              {event.photos.length === 0 ? (
                <div className="bg-secondary mt-6 rounded-3xl p-12 text-center">
                  <div className="text-5xl">📷</div>
                  <h3 className="font-display text-foreground mt-4 text-2xl font-semibold">
                    No photos yet
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    Photos from this event will appear here once shared.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                  {event.photos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      eventName={event.name}
                      userId={userId ?? undefined}
                      userRole={userRole}
                    />
                  ))}
                </div>
              )}
            </BreatheSection>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <EventRsvpCard
                eventId={event.id}
                eventName={event.name}
                eventDate={eventDate}
                location={event.location}
                isPast={isPast}
                isLoggedIn={isLoggedIn}
                rsvpDeadline={event.rsvpDeadline?.toISOString() ?? null}
                maxCapacity={event.maxCapacity ?? null}
                currentAttending={totalAttending}
                existingRsvp={existingRsvpForCard}
              />
            </div>
          </aside>
        </div>
      </div>

      {!isPast && (
        <EventStickyBar
          eventId={event.id}
          eventName={event.name}
          eventDate={eventDate}
          location={event.location}
          isLoggedIn={isLoggedIn}
          existingRsvp={existingRsvpForCard}
          rsvpDeadline={event.rsvpDeadline?.toISOString() ?? null}
          maxCapacity={event.maxCapacity ?? null}
          currentAttending={totalAttending}
          isPast={isPast}
        />
      )}
    </main>
  );
}

function PotluckCategoryCard({
  category,
  dishes,
  totalSlots,
  isLoggedIn,
}: {
  category: string;
  dishes: PrivatePotluckSignup[];
  totalSlots: number;
  isLoggedIn: boolean;
}) {
  const colorByCategory: Record<string, string> = {
    MAIN: 'bg-terracotta/15 text-terracotta',
    SIDE: 'bg-sage/20 text-sage',
    DESSERT: 'bg-sunlight/30 text-[#a07c2f]',
    DRINK: 'bg-secondary text-foreground',
    OTHER: 'bg-secondary text-muted-foreground',
  };
  const chipColor = colorByCategory[category] ?? 'bg-secondary text-foreground';

  const visibleDishes = isLoggedIn ? dishes : dishes.slice(0, 2);
  const hiddenDishesCount = dishes.length - visibleDishes.length;

  return (
    <div className="bg-card shadow-card ring-border/60 w-[260px] shrink-0 rounded-3xl p-6 ring-1 md:w-[280px]">
      <span
        className={`rounded-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold tracking-wider uppercase ${chipColor}`}
      >
        <span>{POTLUCK_CATEGORY_EMOJIS[category] || '📦'}</span>
        {POTLUCK_CATEGORY_LABELS[category] || category}
      </span>
      {dishes.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {visibleDishes.map((dish) => (
            <li key={dish.id}>
              <p className="font-display text-foreground text-lg leading-tight font-medium">
                {dish.dishName}
              </p>
              {isLoggedIn && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {dish.servings > 1 ? `${dish.servings} servings · ` : ''}Brought by{' '}
                  {dish.rsvp.user?.household?.name || dish.rsvp.user?.name || 'A friend'}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm italic">
          We could use a hand here — want to bring something?
        </p>
      )}
      {totalSlots > 0 && (
        <p className="text-muted-foreground mt-4 text-xs">
          {totalSlots} {totalSlots === 1 ? 'slot' : 'slots'} total
        </p>
      )}
      {!isLoggedIn && hiddenDishesCount > 0 && (
        <p className="text-terracotta mt-3 text-xs italic">
          + {hiddenDishesCount} more {hiddenDishesCount === 1 ? 'dish' : 'dishes'} — sign in to see
          who&apos;s bringing what
        </p>
      )}
    </div>
  );
}

function AddDishCard({
  eventId: _eventId,
  existingCategories: _existingCategories,
}: {
  eventId: string;
  existingCategories: string[];
}) {
  return (
    <div className="border-sage/40 hover:bg-sage/5 flex w-[260px] shrink-0 flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-transparent p-6 text-center transition-colors md:w-[280px]">
      <div className="bg-sage/15 flex h-12 w-12 items-center justify-center rounded-full text-2xl">
        🍴
      </div>
      <h4 className="font-display text-foreground mt-3 text-lg font-semibold">Bring a dish</h4>
      <p className="text-muted-foreground mt-1 text-sm">
        Look for an open slot on the menu above and sign up.
      </p>
    </div>
  );
}
