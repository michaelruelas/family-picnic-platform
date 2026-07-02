import { prisma } from '~/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const upcomingEvents = await prisma.event.findMany({
    where: { status: 'PUBLISHED', date: { gte: new Date() } },
    orderBy: { date: 'asc' },
    take: 3,
  });

  return (
    <main className="min-h-screen">
      <header className="bg-amber-700 py-6 text-white shadow-md">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="text-3xl font-bold">Family Picnic Platform</h1>
          <p className="mt-1 text-amber-100">Our annual family gathering made easy</p>
        </div>
      </header>

      {upcomingEvents.length > 0 ? (
        <section className="mx-auto mt-12 max-w-5xl px-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-stone-900">Upcoming Events</h2>
            <Link href="/events" className="text-amber-700 hover:text-amber-900">
              View all →
            </Link>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {upcomingEvents.map((event) => {
              const eventDate = new Date(event.date);
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-stone-900">{event.name}</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    {eventDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {eventDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-stone-600">{event.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-amber-700">
                    <span>📍</span>
                    <span className="truncate">{event.location}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="mx-auto mt-12 max-w-5xl px-4">
          <div className="rounded-2xl bg-amber-50 p-8 text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="mt-4 text-xl font-semibold text-amber-900">No Upcoming Events</h2>
            <p className="mt-2 text-amber-700">Check back soon for our next family gathering!</p>
          </div>
        </div>
      )}

      <section className="mx-auto mt-16 max-w-5xl px-4">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="RSVP"
            description="Let us know who's coming and how many guests you'll be bringing."
            icon="📋"
          />
          <FeatureCard
            title="Potluck Coordination"
            description="Sign up to bring dishes so we can plan the perfect menu together."
            icon="🍴"
          />
          <FeatureCard
            title="Photo Sharing"
            description="Share and enjoy photos from our special family moments."
            icon="📸"
          />
          <FeatureCard
            title="Stay Connected"
            description="Get updates and reminders about the upcoming event."
            icon="📱"
          />
          <FeatureCard
            title="Family Households"
            description="Manage your family profile and keep track of RSVPs."
            icon="👨‍👩‍👧‍👦"
          />
          <FeatureCard
            title="Track Dietary Needs"
            description="Note any dietary requirements so we can accommodate everyone."
            icon="🥗"
          />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-4 pb-16">
        <div className="rounded-2xl bg-amber-50 p-8 text-center">
          <h2 className="text-2xl font-bold text-amber-900">
            Welcome to Our Family Picnic Platform!
          </h2>
          <p className="mt-4 text-amber-800">
            This platform helps us coordinate our annual family gathering. Please sign in with your
            Google account to RSVP and participate in potluck signups.
          </p>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-stone-600">{description}</p>
    </div>
  );
}
