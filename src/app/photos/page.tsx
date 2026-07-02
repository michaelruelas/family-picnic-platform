import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import PhotoCard from '~/components/PhotoCard';
import PhotoSearch from '~/components/photos/PhotoSearch';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

interface SearchResult {
  id: string;
  eventId: string;
  caption: string | null;
  url: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  uploadedByUserId: string;
  uploadedBy?: {
    id: string;
    name: string;
  };
  reactions: {
    reaction: string;
    userId: string;
  }[];
  _count?: {
    reactions: number;
  };
}

async function getEvents() {
  return prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      photos: {
        some: {
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { date: 'desc' },
  });
}

async function searchPhotos(params: {
  q?: string;
  event?: string;
  from?: string;
  to?: string;
  reaction?: string;
  sort?: string;
}) {
  const where: Record<string, unknown> = { deletedAt: null };

  if (params.q) {
    where.OR = [
      { caption: { contains: params.q, mode: 'insensitive' } },
      { uploadedBy: { name: { contains: params.q, mode: 'insensitive' } } },
    ];
  }

  if (params.event) {
    where.eventId = params.event;
  }

  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) {
      (where.createdAt as Record<string, Date>).gte = new Date(params.from);
    }
    if (params.to) {
      (where.createdAt as Record<string, Date>).lte = new Date(params.to + 'T23:59:59');
    }
  }

  if (params.reaction) {
    where.reactions = {
      some: { reaction: params.reaction },
    };
  }

  const orderBy =
    params.sort === 'most_reacted'
      ? { reactions: { _count: 'desc' as const } }
      : { createdAt: 'desc' as const };

  return prisma.photo.findMany({
    where,
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      reactions: true,
      event: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy,
    take: 50,
  });
}

async function getEventsWithPhotos() {
  return prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      photos: {
        some: {
          deletedAt: null,
        },
      },
    },
    include: {
      photos: {
        where: { deletedAt: null },
        select: {
          id: true,
          caption: true,
          url: true,
          thumbnailUrl: true,
          createdAt: true,
          uploadedByUserId: true,
          reactions: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
    orderBy: { date: 'desc' },
  });
}

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; event?: string; from?: string; to?: string; reaction?: string; sort?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  let userRole: string | undefined;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    userRole = user?.role;
  }

  const events = await getEvents();
  const resolvedSearchParams = await searchParams;

  const hasSearchParams =
    resolvedSearchParams.q ||
    resolvedSearchParams.event ||
    resolvedSearchParams.from ||
    resolvedSearchParams.to ||
    resolvedSearchParams.reaction ||
    resolvedSearchParams.sort;

  let searchResults: SearchResult[] | null = null;
  let eventNameMap: Record<string, string> = {};

  if (hasSearchParams) {
    searchResults = await searchPhotos({
      q: resolvedSearchParams.q,
      event: resolvedSearchParams.event,
      from: resolvedSearchParams.from,
      to: resolvedSearchParams.to,
      reaction: resolvedSearchParams.reaction,
      sort: resolvedSearchParams.sort,
    });
    eventNameMap = Object.fromEntries(events.map((e) => [e.id, e.name]));
  }

  const eventsWithPhotos = hasSearchParams ? null : await getEventsWithPhotos();
  const now = new Date();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Photo Gallery</h1>
      <p className="mt-2 text-stone-600">Share and enjoy photos from our family moments</p>

      <div className="mt-6">
        <Suspense fallback={<div className="rounded-xl bg-white p-4 shadow-sm">Loading...</div>}>
          <PhotoSearch events={events} />
        </Suspense>
      </div>

      {searchResults !== null && (
        <div className="mt-6">
          {searchResults.length === 0 ? (
            <div className="rounded-2xl bg-amber-50 p-8 text-center">
              <div className="text-5xl">🔍</div>
              <h2 className="mt-4 text-xl font-semibold text-amber-900">No Photos Found</h2>
              <p className="mt-2 text-amber-700">
                Try adjusting your search filters or search terms.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <p className="text-sm text-stone-500">
                Found {searchResults.length} photo{searchResults.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {searchResults.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    eventName={eventNameMap[photo.eventId] || 'Unknown Event'}
                    userId={userId}
                    userRole={userRole}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {eventsWithPhotos && eventsWithPhotos.length === 0 && !hasSearchParams && (
        <div className="mt-12 rounded-2xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">📸</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No Photos Yet</h2>
          <p className="mt-2 text-amber-700">
            Photo sharing will be available after our first event with photos.
          </p>
        </div>
      )}

      {eventsWithPhotos && eventsWithPhotos.length > 0 && !hasSearchParams && (
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
                      userRole={userRole}
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
