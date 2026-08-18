import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { EventStickyBar } from '~/components/event/EventStickyBar';
import EventNav from '~/components/event/EventNav';
import { BreatheSection } from '~/components/ui/BreatheSection';
import { EventSectionTabs } from '~/components/event/EventSectionTabs';
import { EventHeaderSection } from '~/components/event/EventHeaderSection';
import { formatItineraryTime } from '~/lib/itinerary-time';
import type { RSVPStatus } from '~/lib/generated/enums';
import { AdminPermission } from '~/lib/generated/enums';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * FPP-154: continuous-scroll event overview page.
 *
 * Renders the hero, route-level sub-nav (Overview / Potluck /
 * Photos), then hands off to `<EventSectionTabs>` which stacks the
 * Overview / Itinerary / Additional Info blocks as a single long
 * page with a scroll anchor nav at the top.
 *
 * The desktop sticky RSVP card aside from earlier iterations has
 * been folded into the Overview section — see `EventHeaderSection`
 * — to avoid showing two competing RSVP affordances. The mobile
 * sticky bar still renders below the content.
 */
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
        take: 24,
        include: {
          reactions: {
            select: { reaction: true, userId: true },
          },
        },
      },
      // FPP-43 / FPP-1: PDF attachments surfaced on the public page.
      // Filters out rows a future scan worker has flagged as
      // INFECTED so guests do not see a link they cannot download,
      // and rows whose parent event is not yet PUBLISHED so we
      // never expose filenames before launch. The download endpoint
      // (`/api/public/event-attachments/[id]/download`) re-checks
      // both gates — this filter is belt-and-braces to keep the
      // list itself off draft event pages.
      attachments: {
        where: {
          virusScanStatus: { not: 'INFECTED' },
          event: { status: 'PUBLISHED' },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          filename: true,
          sizeBytes: true,
        },
      },
      // FPP-45 / QUB-31.3: itinerary rows for the public Itinerary
      // tab. Sorted by `order` ascending — the admin editor stores
      // the stable display order, the public page reads it as-is.
      // Tie-break on `time` so two rows with the same wall-clock
      // time still surface in a deterministic order when the host
      // hasn't customized `order`.
      itineraryItems: {
        orderBy: [{ order: 'asc' }, { time: 'asc' }],
      },
    },
  });

  if (!event) {
    notFound();
  }

  const eventDate = new Date(event.date);
  const now = new Date();
  const isPast = eventDate < now;

  const [confirmedHeadcount, userRsvp, userRole, hosts] = await Promise.all([
    prisma.rSVP
      .aggregate({
        where: { eventId: id, status: 'CONFIRMED' },
        _sum: { headcount: true },
      })
      .then((res) => res._sum.headcount ?? 0),
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
      ? prisma.user
          .findUnique({ where: { id: userId }, select: { role: true } })
          .then((u) => u?.role)
      : Promise.resolve(null),
    // FPP-65 / QUB-13.3: public event page lists the host(s). We
    // pull `EventAdmin` rows with role=OWNER (the host permission)
    // and the contact info the user opted into (email is always
    // public; phoneNumber is shown when set). Selection is
    // intentionally narrow — only the public contact surface, no
    // household or admin metadata leaks.
    prisma.eventAdmin
      .findMany({
        where: { eventId: id, role: AdminPermission.OWNER },
        orderBy: { createdAt: 'asc' },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          phoneNumber: row.user.phoneNumber,
        })),
      ),
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
      <BreatheSection className="relative -mt-[73px] h-[55vh] min-h-[420px] w-full overflow-hidden md:h-[40vh]">
        {/* FPP-60: hero precedence is featuredImageUrl -> mapImageUrl
            -> default banner. The featured image is whatever the
            host uploaded through the admin form; the map preview is
            the legacy fallback (QUB-15); the banner is the
            pre-map default. The static-map fallback intentionally
            remains so existing events without a featured image keep
            rendering exactly as before this ticket. */}
        {event.featuredImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.featuredImageUrl}
            alt={event.name}
            className="h-full w-full object-cover"
          />
        ) : event.mapImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.mapImageUrl} alt={event.name} className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/lake-banner.jpg" alt="" className="h-full w-full object-cover" />
        )}
        <div className="from-foreground/40 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
        <div className="absolute top-5 right-5 left-5 flex flex-wrap items-center justify-between gap-3">
          <div className="shadow-soft inline-flex items-center gap-2 rounded-sm border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
            <span className="bg-sunlight h-2 w-2 rounded-sm shadow-[0_0_10px_var(--sunlight)]" />
            {event.status === 'PUBLISHED'
              ? 'Invitation Open'
              : event.status === 'CANCELLED'
                ? 'Cancelled'
                : event.status.charAt(0) + event.status.slice(1).toLowerCase()}
          </div>
          {isPast && (
            <div className="bg-foreground/80 text-background rounded-sm px-4 py-2 text-sm font-medium backdrop-blur-md">
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
        <EventNav
          eventId={event.id}
          dishCount={totalPotluckDishes}
          photoCount={totalPhotos}
          active="overview"
        />
      </div>

      <div className="mx-auto max-w-6xl px-5 pt-6 md:pt-10">
        <EventSectionTabs
          eventId={event.id}
          headerPanel={
            <EventHeaderSection
              eventId={event.id}
              eventName={event.name}
              eventDescription={event.description}
              eventDate={eventDate}
              eventLocation={event.location}
              eventLat={event.lat}
              eventLng={event.lng}
              isPast={isPast}
              isLoggedIn={isLoggedIn}
              rsvpDeadline={event.rsvpDeadline}
              maxCapacity={event.maxCapacity}
              currentAttending={totalAttending}
              registrationFeeCents={event.registrationFeeCents}
              registrationFeeMinAge={event.registrationFeeMinAge}
              currency={event.currency}
              potluckSlots={event.potluckSlots}
              existingRsvp={existingRsvpForCard}
              userRsvpStatus={existingRsvpForCard?.status ?? null}
              // FPP-65 / QUB-13.3: hosts list. Empty array when no
              // host is assigned — the HostBlock component hides
              // itself in that case so we don't render an empty
              // section.
              hosts={hosts}
              // FPP-43 / FPP-1: surface the host's PDF attachments.
              // EventHeaderSection renders nothing when the list is
              // empty so draft events stay quiet.
              attachments={event.attachments.map((a) => ({
                id: a.id,
                filename: a.filename,
                sizeBytes: a.sizeBytes,
              }))}
            />
          }
          itineraryItems={event.itineraryItems.map((item) => ({
            id: item.id,
            time: item.time ? formatItineraryTime(item.time) : null,
            title: item.title,
            description: item.description,
          }))}
          additionalInfo={event.additionalInfo}
          attachments={event.attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            sizeBytes: a.sizeBytes,
          }))}
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
