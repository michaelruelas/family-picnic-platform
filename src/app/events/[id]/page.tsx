import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { EventStickyBar } from '~/components/event/EventStickyBar';
import EventSubNav from '~/components/event/EventSubNav';
import { BreatheSection } from '~/components/ui/BreatheSection';
import { EventTabs, EVENT_TAB_KEYS, type EventTabKey } from '~/components/event/EventTabs';
import { EventHeaderSection } from '~/components/event/EventHeaderSection';
import type { RSVPStatus } from '~/lib/generated/enums';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}

function resolveInitialTab(tabParam: string | string[] | undefined): EventTabKey {
  const raw = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  return EVENT_TAB_KEYS.includes(raw as EventTabKey) ? (raw as EventTabKey) : 'header';
}

/**
 * FPP-46: tabbed event overview page.
 *
 * Renders the hero, route-level sub-nav (Overview / Potluck / Photos),
 * then delegates the within-page sections to `<EventTabs>`. The tabbed
 * shell swaps between `Tabs` (desktop, with keyboard nav and URL deep
 * links) and `EventAnchorNav` (mobile, scroll anchors) under the hood.
 *
 * The desktop sticky RSVP card aside from earlier iterations has been
 * folded into the Header tab — see `EventHeaderSection` — to avoid
 * showing two competing RSVP affordances. The mobile sticky bar still
 * renders below the content.
 */
export default async function EventDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const initialTab = resolveInitialTab(tabParam);

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
        take: 24,
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
              id: true,
              status: true,
              headcount: true,
              waitlistPosition: true,
              modifiedAt: true,
              memberAttendances: {
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  householdMemberId: true,
                  memberNameSnapshot: true,
                  memberAgeSnapshot: true,
                  attending: true,
                },
              },
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
        : Promise.resolve(null),
    ]);

  // Load the caller's Registration row in parallel so the RSVP card
  // can show the fee total alongside the summary. Free events have
  // no row; we pass 0 so the card stays uncluttered.
  const userRegistration = userId
    ? await prisma.registration.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
        select: { amountCents: true, currency: true, status: true },
      })
    : null;
  const registrationFeeCents = userRegistration?.amountCents ?? 0;
  const registrationFeeCurrency = userRegistration?.currency ?? event.currency;

  const totalAttending = confirmedHeadcount;
  const totalPotluckDishes = event.potluckSlots.reduce((sum, slot) => sum + slot.signups.length, 0);
  const totalPhotos = event.photos.length;

  const existingRsvpForCard = userRsvp
    ? {
        id: userRsvp.id,
        status: userRsvp.status as RSVPStatus,
        headcount: userRsvp.headcount,
        modifiedAt: userRsvp.modifiedAt.toISOString(),
        memberAttendances: userRsvp.memberAttendances.map((att) => ({
          id: att.id,
          householdMemberId: att.householdMemberId,
          memberName: att.memberNameSnapshot,
          memberAge: att.memberAgeSnapshot,
          attending: att.attending,
        })),
        registrationFeeCents,
        registrationFeeCurrency,
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

      <div className="mx-auto max-w-6xl px-5 pt-6 md:pt-8">
        <EventSubNav
          eventId={event.id}
          dishCount={totalPotluckDishes}
          photoCount={totalPhotos}
          active="overview"
        />
      </div>

      <div className="mx-auto max-w-6xl px-5 pt-6 md:pt-10">
        <EventTabs
          eventId={event.id}
          initialTab={initialTab}
          headerPanel={
            <EventHeaderSection
              eventId={event.id}
              eventName={event.name}
              eventDescription={event.description}
              eventDate={eventDate}
              eventLocation={event.location}
              isPast={isPast}
              isLoggedIn={isLoggedIn}
              rsvpDeadline={event.rsvpDeadline}
              maxCapacity={event.maxCapacity}
              currentAttending={totalAttending}
              registrationFeeCents={event.registrationFeeCents}
              registrationFeeMinAge={event.registrationFeeMinAge}
              currency={event.currency}
              potluckSlots={event.potluckSlots}
              pendingInvitations={pendingInvitations}
              pendingInvitationCount={pendingInvitationCount}
              existingRsvp={existingRsvpForCard}
              userRsvpStatus={existingRsvpForCard?.status ?? null}
            />
          }
          itineraryItems={PLACEHOLDER_ITINERARY}
          additionalInfo={null}
          photos={event.photos}
          eventName={event.name}
          userId={userId}
          userRole={userRole ?? null}
        />
      </div>

      {!isPast && (
        <EventStickyBar
          eventId={event.id}
          eventDate={eventDate}
          location={event.location}
          isLoggedIn={isLoggedIn}
          existingRsvp={existingRsvpForCard ? { status: existingRsvpForCard.status } : null}
          rsvpDeadline={event.rsvpDeadline?.toISOString() ?? null}
          maxCapacity={event.maxCapacity ?? null}
          currentAttending={totalAttending}
          isPast={isPast}
          registrationFeeConfig={
            event.registrationFeeCents && event.registrationFeeCents > 0
              ? {
                  amountCents: event.registrationFeeCents,
                  minAge: event.registrationFeeMinAge,
                  currency: event.currency,
                }
              : null
          }
        />
      )}
    </main>
  );
}

/**
 * FPP-9 placeholder: until QUB-31 ships the `ItineraryItem` model +
 * admin CRUD, the event page renders this static outline so the
 * Itinerary tab is never blank. Replace with a real query against
 * `prisma.itineraryItem.findMany({ where: { eventId }, orderBy: [{ order: 'asc' }, { time: 'asc' }] })`
 * once the schema lands.
 */
const PLACEHOLDER_ITINERARY = [
  {
    id: 'placeholder-setup',
    time: '10:00 AM',
    title: 'Setup & Early Arrival',
    description: 'Unloading coolers and firing up the grill.',
  },
  {
    id: 'placeholder-feast',
    time: '12:30 PM',
    title: 'The Big Feast',
    description: 'Potluck lines open. Elders served first.',
  },
  {
    id: 'placeholder-games',
    time: '2:00 PM',
    title: 'Family Games',
    description: 'Annual relay races and water balloons.',
  },
  {
    id: 'placeholder-photos',
    time: '4:00 PM',
    title: 'Golden Hour Photos',
    description: 'Find the cousins. Find the shade. Smile.',
  },
];
