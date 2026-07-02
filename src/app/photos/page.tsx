import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import PhotoCard from '~/components/PhotoCard';

export const dynamic = 'force-dynamic';

export default async function PhotosPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const eventsWithPhotos = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      photos: {
        some: {},
      },
    },
    include: {
      photos: {
        select: {
          id: true,
          caption: true,
          url: true,
          thumbnailUrl: true,
          createdAt: true,
          reactions: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
    orderBy: { date: 'desc' },
  });

  const now = new Date();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Photo Gallery</h1>
      <p className="mt-2 text-stone-600">Share and enjoy photos from our family moments</p>

      {eventsWithPhotos.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">📸</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No Photos Yet</h2>
          <p className="mt-2 text-amber-700">
            Photo sharing will be available after our first event with photos.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {eventsWithPhotos.map((event) => {
            const eventDate = new Date(event.date);
            const isPast = eventDate < now;

            return (
              <div key={event.id} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <Link
                      href={`/events/${event.id}`}
                      className="text-xl font-semibold text-stone-900 hover:text-amber-700"
                    >
                      {event.name}
                    </Link>
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
                  </div>
                  {isPast && (
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                      Past
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {event.photos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      eventName={event.name}
                      userId={userId}
                    />
                  ))}
                </div>

                <Link
                  href={`/events/${event.id}`}
                  className="mt-4 block w-full rounded-lg bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-700"
                >
                  View All Photos from {event.name}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
