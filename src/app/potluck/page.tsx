import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS } from '~/lib/constants';

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
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Potluck Sign-ups</h1>
      <p className="mt-2 text-stone-600">Coordinate dishes for our family gatherings</p>

      {eventsWithPotlucks.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">🍴</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No Potluck Events Yet</h2>
          <p className="mt-2 text-amber-700">
            Check back soon when an event organizer sets up potluck sign-ups.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {eventsWithPotlucks.map((event) => {
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
              <div
                key={event.id}
                className={`rounded-xl bg-white p-6 shadow-sm ${isPast ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900">{event.name}</h3>
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
                    <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                      <span>📍</span>
                      <span>{event.location}</span>
                    </p>
                  </div>
                  {isPast && (
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                      Past
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {Object.entries(slotsByCategory).map(([category, slots]) => (
                    <div key={category} className="flex items-center gap-2">
                      <span className="text-lg">{POTLUCK_CATEGORY_EMOJIS[category] || '📦'}</span>
                      <span className="text-sm text-stone-600">
                        {POTLUCK_CATEGORY_LABELS[category] || category}: {slots.length} slot
                        {slots.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  href={`/events/${event.id}`}
                  className="mt-4 block w-full rounded-lg bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-700"
                >
                  {isPast ? 'View Details' : 'Sign Up for Dishes'}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-12 rounded-2xl bg-amber-100 p-8 text-center">
        <h2 className="text-xl font-semibold text-amber-900">Want to organize a potluck?</h2>
        <p className="mt-2 text-amber-700">Contact an admin to add potluck slots to your event.</p>
      </div>
    </main>
  );
}
