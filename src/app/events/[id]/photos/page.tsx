import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import UploadButton from '~/components/photos/UploadButton';
import PhotoGallery from '~/components/photos/PhotoGallery';
import EventNav from '~/components/event/EventNav';
import { BreatheSection } from '~/components/ui/BreatheSection';

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
      <BreatheSection>
        <div className="mx-auto max-w-4xl px-5 pt-10 md:pt-14">
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
      </BreatheSection>

      <div className="mx-auto max-w-4xl px-5">
        <div className="mt-6">
          <EventNav
            eventId={event.id}
            dishCount={dishCount}
            photoCount={photoCount}
            active="photos"
          />
        </div>

        {userId && (
          <div className="mt-8">
            <UploadButton eventId={event.id} />
          </div>
        )}

        {event.photos.length === 0 ? (
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
