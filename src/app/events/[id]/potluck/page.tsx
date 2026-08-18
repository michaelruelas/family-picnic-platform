import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import Link from 'next/link';
import { RSVPStatus, EventStatus } from '~/lib/generated/enums';
import { BreatheSection } from '~/components/ui/BreatheSection';
import MySlotsSummary from '~/components/potluck/MySlotsSummary';
import SlotList, { type EventSlot } from '~/components/potluck/SlotList';
import EventNav from '~/components/event/EventNav';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: event ? `${event.name} · Potluck` : 'Potluck',
  };
}

export default async function EventPotluckPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
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
                  userId: true,
                  // FPP-127: walk through the user to read the
                  // household name (RSVP has no household FK).
                  user: {
                    select: {
                      id: true,
                      name: true,
                      household: { select: { id: true, name: true } },
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

  const userRsvp = userId
    ? await prisma.rSVP.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
        select: { id: true, status: true },
      })
    : null;

  const hasRsvp = !!userRsvp;
  const isRsvpConfirmed = userRsvp?.status === RSVPStatus.CONFIRMED;
  const isEventPublished = event.status === EventStatus.PUBLISHED;
  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();

  const slots: EventSlot[] = event.potluckSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    category: slot.category,
    slotType: slot.slotType,
    maxSignups: slot.maxSignups,
    currentSignups: slot.currentSignups,
    signups: slot.signups.map((s) => ({
      id: s.id,
      dishName: s.dishName,
      servings: s.servings,
      dietaryLabels: s.dietaryLabels,
      rsvp: {
        userId: s.rsvp.userId,
        user: s.rsvp.user,
        // FPP-127: prefer the household name as the label. The
        // user name is still on the row for the "is mine?" badge.
        householdName: s.rsvp.user.household?.name ?? null,
      },
    })),
  }));

  const dishCount = slots.reduce((sum, slot) => sum + slot.signups.length, 0);

  const eventPhotos = await prisma.photo.count({
    where: { eventId: id, deletedAt: null },
  });

  return (
    <main className="bg-background min-h-screen pb-24">
      <BreatheSection>
        <div className="mx-auto max-w-4xl px-5 pt-10 md:pt-14">
          <Link
            href={`/events/${event.id}`}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold"
          >
            ← Back to {event.name}
          </Link>
          <p className="text-terracotta mt-4 text-sm font-semibold tracking-widest uppercase">
            The menu
          </p>
          <h1 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight md:text-5xl">
            Potluck
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-base">
            Pick what your household will bring. You can claim more than one dish — one per slot.
          </p>
        </div>
      </BreatheSection>

      <div className="mx-auto max-w-4xl px-5">
        <div className="mt-6">
          <EventNav
            eventId={event.id}
            dishCount={dishCount}
            photoCount={eventPhotos}
            active="potluck"
          />
        </div>
        {userId && (
          <div
            className="bg-sunlight/20 ring-sunlight/40 mt-6 flex flex-col gap-3 rounded-sm px-5 py-4 text-sm ring-1 sm:flex-row sm:items-center sm:justify-between"
            data-testid="potluck-readonly-banner"
          >
            <p className="text-foreground">
              <span className="font-semibold">Bring a dish from your RSVP.</span> Open the sheet to
              claim a slot.
            </p>
            <Link
              href={`/events/${event.id}?rsvpOpen=1#dishes`}
              className="bg-foreground text-background press hover:bg-foreground/90 inline-flex items-center justify-center rounded-sm px-4 py-2 text-sm font-semibold transition-all"
              data-testid="potluck-edit-my-dishes"
            >
              Edit my dishes
            </Link>
          </div>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="order-2 lg:order-1">
            {!isEventPublished || isPast ? (
              <div className="bg-secondary/40 rounded-sm p-10 text-center">
                <div className="text-4xl">🕒</div>
                <h2 className="font-display text-foreground mt-3 text-2xl font-semibold">
                  Potluck signups are closed
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  {isPast
                    ? 'This gathering has already happened.'
                    : 'The event has not been published yet.'}
                </p>
              </div>
            ) : (
              <SlotList
                eventId={event.id}
                slots={slots}
                userId={userId}
                isRsvpConfirmed={isRsvpConfirmed}
                hasRsvp={hasRsvp}
                readOnly
              />
            )}
          </div>

          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-24">
              <MySlotsSummary
                eventId={event.id}
                hasRsvp={hasRsvp}
                isRsvpConfirmed={isRsvpConfirmed}
                userId={userId}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
