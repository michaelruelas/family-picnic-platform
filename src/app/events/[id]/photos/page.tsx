import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import PhotoCard from '~/components/PhotoCard';
import { BreatheSection } from '~/components/ui/BreatheSection';
import UploadButton from '~/components/photos/UploadButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventPhotosPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const isLoggedIn = !!userId;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true, date: true, status: true },
  });

  if (!event) {
    notFound();
  }

  const userRole = userId
    ? (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role
    : undefined;

  const photos = await prisma.photo.findMany({
    where: { eventId: id, deletedAt: null },
    include: {
      uploadedBy: { select: { id: true, name: true } },
      reactions: { select: { reaction: true, userId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const eventDate = new Date(event.date);
  const now = new Date();
  const isPast = eventDate < now;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 md:py-20">
      <BreatheSection>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
          <Link href={`/events/${event.id}`} className="hover:text-foreground transition-colors">
            ← {event.name}
          </Link>
        </p>
        <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
          Photos
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-lg">
          {photos.length === 0
            ? isPast
              ? 'No photos were shared from this gathering.'
              : 'No photos yet. Be the first to share a moment from this event.'
            : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} from this gathering.`}
        </p>
      </BreatheSection>

      {isLoggedIn && !isPast && event.status === 'PUBLISHED' && (
        <BreatheSection>
          <div className="mt-10">
            <UploadButton eventId={event.id} />
          </div>
        </BreatheSection>
      )}

      {photos.length === 0 ? (
        <BreatheSection>
          <div className="bg-sunlight/20 ring-sunlight/40 mt-10 rounded-3xl p-16 text-center ring-1">
            <div className="text-6xl">📸</div>
            <h2 className="font-display text-foreground mt-6 text-3xl font-semibold">
              No photos yet
            </h2>
            <p className="text-muted-foreground mt-3">
              {isPast
                ? 'When photos are shared they will show up here.'
                : isLoggedIn
                  ? 'Share the first photo from this gathering.'
                  : 'Sign in to share a moment from the event.'}
            </p>
          </div>
        </BreatheSection>
      ) : (
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              eventName={event.name}
              userId={userId}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </main>
  );
}
