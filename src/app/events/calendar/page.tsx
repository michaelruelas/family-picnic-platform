import { prisma } from '~/lib/prisma';
import { Calendar } from '~/components/event/Calendar';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
    },
    orderBy: { date: 'asc' },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Event Calendar</h1>
          <p className="mt-1 text-stone-600">View all family gatherings on a monthly calendar</p>
        </div>
        <Link
          href="/events"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          List View
        </Link>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <Calendar events={events} />
      </div>

      {events.length === 0 && (
        <div className="mt-8 rounded-2xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">📅</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No Events Yet</h2>
          <p className="mt-2 text-amber-700">Check back soon for our next family gathering!</p>
        </div>
      )}
    </main>
  );
}
