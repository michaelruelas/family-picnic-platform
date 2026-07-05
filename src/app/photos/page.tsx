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
  searchParams: Promise<{
    q?: string;
    event?: string;
    from?: string;
    to?: string;
    reaction?: string;
    sort?: string;
  }>;
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
    <main className="mx-auto max-w-6xl px-5 py-12 md:py-20">
      <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Memories</p>
      <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
        Photo Gallery
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-lg">
        Share and enjoy the candid moments from our family gatherings.
      </p>

      <div className="mt-8">
        <Suspense fallback={<div className="bg-card shadow-card rounded-3xl p-6">Loading...</div>}>
          <PhotoSearch events={events} />
        </Suspense>
      </div>

      {searchResults !== null && (
        <div className="mt-8">
          {searchResults.length === 0 ? (
            <div className="bg-sunlight/20 ring-sunlight/40 rounded-3xl p-12 text-center ring-1">
              <div className="text-5xl">🔍</div>
              <h2 className="font-display text-foreground mt-4 text-2xl font-semibold">
                No photos found
              </h2>
              <p className="text-muted-foreground mt-2">
                Try adjusting your search filters or search terms.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-muted-foreground text-sm">
                Found {searchResults.length} photo{searchResults.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
        <div className="bg-sunlight/20 ring-sunlight/40 mt-14 rounded-3xl p-16 text-center ring-1">
          <div className="text-6xl">📸</div>
          <h2 className="font-display text-foreground mt-6 text-3xl font-semibold">
            No photos yet
          </h2>
          <p className="text-muted-foreground mt-3">
            Photo sharing will be available after our first event with photos.
          </p>
        </div>
      )}

      {eventsWithPhotos && eventsWithPhotos.length > 0 && !hasSearchParams && (
        <div className="mt-12 space-y-12">
          {eventsWithPhotos.map((event) => {
            const eventDate = new Date(event.date);
            const isPast = eventDate < now;

            return (
              <div
                key={event.id}
                className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <Link
                      href={`/events/${event.id}`}
                      className="font-display text-foreground hover:text-terracotta text-2xl font-medium transition-colors"
                    >
                      {event.name}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {eventDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  {isPast && (
                    <span className="rounded-pill bg-secondary text-muted-foreground px-3 py-1 text-xs font-semibold">
                      Past
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
                  className="rounded-pill border-border bg-card text-foreground press hover:border-foreground mt-5 block w-full border px-5 py-3 text-center text-sm font-semibold transition-all"
                >
                  View all photos from {event.name}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
