import { permanentRedirect } from 'next/navigation';
import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { BreatheSection } from '~/components/ui/BreatheSection';

export const dynamic = 'force-dynamic';

/**
 * Legacy `/photos` is gone. Photos now live under each event at
 * `/events/:id/photos`. When a single published event has photos
 * we 301 to it. We prefer the next-upcoming event so the user lands
 * somewhere they can still contribute, falling back to the most
 * recent past event. If no event can host the redirect we render a
 * friendly message instead of a hard 404.
 */
export default async function PhotosPage() {
  const now = new Date();

  const upcoming = await prisma.event.findFirst({
    where: {
      status: 'PUBLISHED',
      date: { gte: now },
      photos: { some: { deletedAt: null } },
    },
    orderBy: { date: 'asc' },
    select: { id: true },
  });

  if (upcoming) {
    permanentRedirect(`/events/${upcoming.id}/photos`);
  }

  const past = await prisma.event.findFirst({
    where: {
      status: 'PUBLISHED',
      date: { lt: now },
      photos: { some: { deletedAt: null } },
    },
    orderBy: { date: 'desc' },
    select: { id: true },
  });

  if (past) {
    permanentRedirect(`/events/${past.id}/photos`);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-24">
      <BreatheSection>
        <div className="bg-card shadow-card ring-border/60 rounded-3xl p-12 text-center ring-1">
          <div className="text-6xl">📸</div>
          <h1 className="font-display text-foreground mt-6 text-3xl font-medium tracking-tight">
            No photos to show
          </h1>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            Photos now live on each event page. Browse the events calendar to find a gathering with
            shared moments.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/events"
              className="rounded-pill bg-terracotta shadow-soft press px-6 py-3 font-semibold text-white hover:bg-[#cf6c52]"
            >
              Browse events
            </Link>
            <Link
              href="/"
              className="rounded-pill border-border bg-card text-foreground press hover:border-foreground border px-6 py-3 font-semibold"
            >
              Go home
            </Link>
          </div>
        </div>
      </BreatheSection>
    </main>
  );
}
