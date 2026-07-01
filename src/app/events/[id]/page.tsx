import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      potluckSlots: {
        orderBy: { category: 'asc' },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const eventDate = new Date(event.date);
  const now = new Date();
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

  const categoryLabels: Record<string, string> = {
    MAIN: 'Main Dishes',
    SIDE: 'Side Dishes',
    DESSERT: 'Desserts',
    DRINK: 'Drinks',
    OTHER: 'Other Items',
  };

  const categoryEmojis: Record<string, string> = {
    MAIN: '🍖',
    SIDE: '🥗',
    DESSERT: '🍰',
    DRINK: '🥤',
    OTHER: '📦',
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-900"
      >
        <span>←</span> Back to Events
      </Link>

      <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">{event.name}</h1>
            <p className="mt-2 text-lg text-stone-600">
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isPast && (
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-600">
                Past Event
              </span>
            )}
            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                event.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-700'
                  : event.status === 'DRAFT'
                    ? 'bg-yellow-100 text-yellow-700'
                    : event.status === 'CANCELLED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-stone-100 text-stone-600'
              }`}
            >
              {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4 text-stone-500">
          <span className="text-xl">📍</span>
          <span className="text-lg">{event.location}</span>
        </div>

        <p className="mt-6 text-stone-700">{event.description}</p>

        {event.maxCapacity && (
          <div className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-800">
            <span className="font-medium">Max Capacity:</span> {event.maxCapacity} people
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-stone-900">Potluck Sign-ups</h2>
        <p className="mt-2 text-stone-600">Sign up to bring a dish for this event</p>

        {event.potluckSlots.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-amber-50 p-8 text-center">
            <div className="text-5xl">🍴</div>
            <h3 className="mt-4 text-xl font-semibold text-amber-900">No Potluck Slots Yet</h3>
            <p className="mt-2 text-amber-700">
              The organizer hasn&apos;t set up potluck sign-ups for this event yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {Object.entries(slotsByCategory).map(([category, slots]) => (
              <div key={category} className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
                  <span className="text-2xl">{categoryEmojis[category] || '📦'}</span>
                  {categoryLabels[category] || category}
                </h3>
                <div className="mt-4 space-y-3">
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between rounded-lg border border-stone-200 p-3"
                    >
                      <div>
                        <p className="font-medium text-stone-900">{slot.name}</p>
                        <p className="text-sm text-stone-500">
                          {slot.slotType === 'UNLIMITED'
                            ? 'Unlimited signups'
                            : `${slot.currentSignups}/${slot.maxSignups} slots filled`}
                        </p>
                      </div>
                      {slot.slotType === 'LIMITED' &&
                      slot.currentSignups < (slot.maxSignups || 0) ? (
                        <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                          Sign Up
                        </button>
                      ) : slot.slotType === 'UNLIMITED' ? (
                        <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                          Sign Up
                        </button>
                      ) : (
                        <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
                          Full
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
