import { prisma } from '~/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { date: 'asc' },
    take: 10,
  });

  const now = new Date();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Upcoming Events</h1>
      <p className="mt-2 text-stone-600">Join our family gatherings and make lasting memories</p>

      {events.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No Upcoming Events</h2>
          <p className="mt-2 text-amber-700">Check back soon for our next family gathering!</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {events.map((event) => {
            const eventDate = new Date(event.date);
            const isPast = eventDate < now;
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className={`block rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                  isPast ? 'opacity-60' : ''
                }`}
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
                      })}
                    </p>
                  </div>
                  {isPast && (
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                      Past
                    </span>
                  )}
                </div>
                <p className="mt-3 text-stone-600">{event.description}</p>
                <div className="mt-4 flex items-center gap-4 text-sm text-stone-500">
                  <span>📍 {event.location}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-12 rounded-2xl bg-amber-100 p-8 text-center">
        <h2 className="text-xl font-semibold text-amber-900">Want to organize an event?</h2>
        <p className="mt-2 text-amber-700">Contact an admin to create a new family gathering.</p>
      </div>
    </main>
  );
}
