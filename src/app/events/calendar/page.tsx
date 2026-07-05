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
          <h1 className="text-foreground text-3xl font-bold">Event Calendar</h1>
          <p className="text-muted-foreground mt-1">
            View all family gatherings on a monthly calendar
          </p>
        </div>
        <Link
          href="/events"
          className="border-border text-foreground/85 hover:bg-secondary/60 rounded-lg border bg-white px-4 py-2 text-sm font-medium transition-colors"
        >
          List View
        </Link>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <Calendar events={events} />
      </div>

      {events.length === 0 && (
        <div className="bg-sunlight/20 mt-8 rounded-2xl p-8 text-center">
          <div className="text-5xl">📅</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No Events Yet</h2>
          <p className="text-terracotta mt-2">Check back soon for our next family gathering!</p>
        </div>
      )}
    </main>
  );
}
