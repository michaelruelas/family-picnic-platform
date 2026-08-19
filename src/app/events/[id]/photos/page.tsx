import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import UploadButton from '~/components/photos/UploadButton';
import PhotoGallery from '~/components/photos/PhotoGallery';
import EventNav from '~/components/event/EventNav';
import EventHero from '~/components/event/EventHero';
import { SignInPrompt } from '~/components/event/SignInPrompt';

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
    title: event ? `${event.name} · Photos` : 'Photos',
  };
}

export default async function EventPhotosPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? undefined;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          reactions: {
            select: { reaction: true, userId: true },
          },
          household: {
            select: { name: true },
          },
        },
      },
      potluckSlots: {
        select: { signups: { where: { rsvp: { status: 'CONFIRMED' } } } },
      },
    },
  });

  // Hero image lives outside the include scope (it's a top-level
  // field), so fetch it separately. Cheap point-read, no joins.
  const heroMedia = await prisma.event.findUnique({
    where: { id },
    select: { featuredImageUrl: true, mapImageUrl: true },
  });

  if (!event) {
    notFound();
  }

  let userRole: string | undefined;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    userRole = user?.role;
  }

  const dishCount = event.potluckSlots.reduce((sum, slot) => sum + slot.signups.length, 0);
  const photoCount = event.photos.length;

  return (
    <main className="bg-background min-h-screen pb-24">
      <EventHero
        name={event.name}
        featuredImageUrl={heroMedia?.featuredImageUrl ?? null}
        mapImageUrl={heroMedia?.mapImageUrl ?? null}
        size="compact"
      />
      <div className="mx-auto max-w-5xl px-5 pt-6 md:pt-8">
        <EventNav
          eventId={event.id}
          dishCount={dishCount}
          photoCount={photoCount}
          active="photos"
        />
      </div>

      <div className="mx-auto max-w-5xl px-5 pt-8 md:pt-10">
        <div>
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            Memories
          </p>
          <h1 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight md:text-5xl">
            {event.name} · Photos
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-base">
            Share and enjoy the candid moments from {event.name}.
          </p>
        </div>

        {userId && (
          <div className="mt-8">
            <UploadButton eventId={event.id} />
          </div>
        )}

        {!userId ? (
          // Auth gate: photo gallery contents are personal — uploader
          // identity (via household name) + the candid moments
          // themselves stay private until the viewer signs in.
          // Counts in the EventNav (e.g. "12") stay public so guests
          // see there's something to come back for.
          <div className="mt-10">
            <SignInPrompt
              title="Photos are just for family"
              description="Sign in to see the candid moments shared from this gathering."
            />
          </div>
        ) : event.photos.length === 0 ? (
          <div className="bg-secondary mt-10 rounded-sm p-12 text-center">
            <div className="text-5xl">📷</div>
            <h3 className="font-display text-foreground mt-4 text-2xl font-semibold">
              No photos yet
            </h3>
            <p className="text-muted-foreground mt-2">
              {userId
                ? 'Be the first to share a moment from this gathering.'
                : 'Photos from this event will appear here once shared.'}
            </p>
          </div>
        ) : (
          <PhotoGallery
            photos={event.photos.map((p) => ({
              id: p.id,
              caption: p.caption,
              url: p.url,
              thumbnailUrl: p.thumbnailUrl,
              createdAt: p.createdAt,
              uploadedByUserId: p.uploadedByUserId,
              household: p.household,
              reactions: p.reactions,
            }))}
            eventName={event.name}
            userId={userId}
            userRole={userRole}
          />
        )}
      </div>
    </main>
  );
}
