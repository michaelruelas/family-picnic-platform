import { prisma } from '~/lib/prisma';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { BreatheSection } from '~/components/ui/BreatheSection';
import { PhotoCredit } from '~/components/ui/PhotoCredit';
import { HERO_IMAGES } from '~/lib/constants';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [upcomingEvents, session] = await Promise.all([
    prisma.event.findMany({
      where: { status: 'PUBLISHED', date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 3,
    }),
    getServerSession(authOptions),
  ]);

  const nextEvent = upcomingEvents[0];
  const nextEventDate = nextEvent ? new Date(nextEvent.date) : null;
  const isLoggedIn = !!session?.user?.id;

  return (
    <main className="bg-background pb-24">
      <section className="relative isolate overflow-hidden">
        {/* Background image layer (sits behind content but in front of the page) */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGES.home.url})` }}
          role="img"
          aria-label={`${HERO_IMAGES.home.alt}. Photo by ${HERO_IMAGES.home.credit.photographer} on ${HERO_IMAGES.home.credit.platform}.`}
        />
        {/* Gradient overlays for legibility */}
        <div className="from-foreground/40 via-foreground/20 to-background absolute inset-0 z-10 bg-gradient-to-b" />
        <div className="from-foreground/60 absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t to-transparent" />
        {/* Content (sits above the image and overlays) */}
        <div className="relative z-20 mx-auto flex min-h-[78vh] max-w-5xl flex-col justify-end px-5 pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="max-w-2xl">
            <div className="rounded-pill shadow-soft inline-flex items-center gap-2 border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
              <span className="bg-sunlight h-2 w-2 rounded-full shadow-[0_0_10px_#f2cc8f]" />
              {nextEvent
                ? `Next gathering · ${nextEventDate!.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
                : 'Welcome to the family'}
            </div>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] font-medium tracking-tight text-white sm:text-6xl md:text-7xl">
              The Family Picnic,
              <br />
              <span className="text-sunlight italic">made simple.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/90 md:text-xl">
              One place to RSVP, sign up for the potluck, share photos, and stay close to the people
              who make every summer feel like coming home.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              {nextEvent ? (
                <Link
                  href={`/events/${nextEvent.id}`}
                  className="rounded-pill bg-terracotta shadow-pop press px-7 py-3.5 text-base font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#cf6c52]"
                >
                  See the invitation →
                </Link>
              ) : (
                <Link
                  href="/events"
                  className="rounded-pill bg-terracotta shadow-pop press px-7 py-3.5 text-base font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#cf6c52]"
                >
                  Browse Events →
                </Link>
              )}
              {!isLoggedIn && (
                <Link
                  href="/login"
                  className="rounded-pill press border border-white/50 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="pointer-events-auto absolute right-4 bottom-3 z-30 sm:right-6 sm:bottom-4">
          <PhotoCredit
            photographer={HERO_IMAGES.home.credit.photographer}
            photographerUrl={HERO_IMAGES.home.credit.photographerUrl}
            platform={HERO_IMAGES.home.credit.platform}
            licenseUrl={HERO_IMAGES.home.credit.licenseUrl}
            ariaLabel={`Photo credit: ${HERO_IMAGES.home.credit.photographer} on ${HERO_IMAGES.home.credit.platform} (${HERO_IMAGES.home.credit.licenseUrl})`}
          />
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-5xl px-5">
        <BreatheSection>
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                Coming up
              </p>
              <h2 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight md:text-5xl">
                Upcoming gatherings
              </h2>
            </div>
            <Link
              href="/events"
              className="text-terracotta decoration-terracotta/30 hover:decoration-terracotta text-sm font-semibold underline underline-offset-4 transition-colors"
            >
              See all events →
            </Link>
          </div>
        </BreatheSection>

        {upcomingEvents.length > 0 ? (
          <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event, idx) => {
              const eventDate = new Date(event.date);
              return (
                <BreatheSection key={event.id} delay={idx * 80}>
                  <Link
                    href={`/events/${event.id}`}
                    className="group bg-card shadow-card ring-border/60 hover-lift block overflow-hidden rounded-3xl ring-1 transition-all duration-300"
                  >
                    <div className="bg-sage/15 relative aspect-[4/3] overflow-hidden">
                      {event.mapImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.mapImageUrl}
                          alt={event.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="from-sunlight/40 via-sage/20 to-terracotta/15 flex h-full w-full items-center justify-center bg-gradient-to-br">
                          <span className="text-5xl">🌳</span>
                        </div>
                      )}
                      <div className="bg-card/90 text-foreground shadow-soft absolute top-4 left-4 rounded-2xl px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                        {eventDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="font-display text-foreground text-2xl leading-tight font-medium">
                        {event.name}
                      </h3>
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
                        {event.description}
                      </p>
                      <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
                        <span className="text-sage">📍</span>
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>
                  </Link>
                </BreatheSection>
              );
            })}
          </div>
        ) : (
          <BreatheSection>
            <div className="bg-sunlight/20 ring-sunlight/40 mt-10 rounded-3xl p-12 text-center ring-1">
              <div className="text-5xl">🌅</div>
              <h3 className="font-display text-foreground mt-4 text-2xl font-semibold">
                No events on the calendar yet
              </h3>
              <p className="text-muted-foreground mt-2">
                Check back soon — someone is probably planning something wonderful.
              </p>
            </div>
          </BreatheSection>
        )}
      </section>

      <section className="mx-auto mt-28 max-w-5xl px-5">
        <BreatheSection>
          <div className="text-center">
            <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
              What you can do
            </p>
            <h2 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight md:text-5xl">
              A little bit of everything,
              <br />
              <span className="text-sage italic">nothing complicated.</span>
            </h2>
          </div>
        </BreatheSection>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, idx) => (
            <BreatheSection key={feature.title} delay={idx * 80}>
              <div className="bg-card shadow-card ring-border/60 hover-lift rounded-3xl p-7 ring-1 transition-all duration-300">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${feature.bgClass}`}
                >
                  <span className="text-2xl">{feature.emoji}</span>
                </div>
                <h3 className="font-display text-foreground mt-5 text-xl font-semibold">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </BreatheSection>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-28 max-w-5xl px-5">
        <BreatheSection>
          <div className="bg-foreground shadow-pop overflow-hidden rounded-[2rem] p-10 md:p-16">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="text-sunlight text-sm font-semibold tracking-widest uppercase">
                  The invitation
                </p>
                <h2 className="font-display text-background mt-2 text-3xl leading-tight font-medium md:text-4xl">
                  Pull up a chair, the table is set.
                </h2>
                <p className="text-background/75 mt-4 text-base leading-relaxed">
                  Sign in once and you&apos;re part of the family loop. RSVP, claim a dish, and
                  check in on the people you love.
                </p>
              </div>
              <Link
                href={isLoggedIn ? '/events' : '/login'}
                className="rounded-pill bg-terracotta shadow-pop press shrink-0 px-7 py-3.5 text-base font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#cf6c52]"
              >
                {isLoggedIn ? 'Browse Events' : 'Sign in to start'}
              </Link>
            </div>
          </div>
        </BreatheSection>
      </section>
    </main>
  );
}

const features = [
  {
    title: 'RSVP in a heartbeat',
    description:
      'Tap a button, pick a headcount, done. No forms, no fuss — just like answering a text from a sibling.',
    emoji: '✉️',
    bgClass: 'bg-terracotta/15',
  },
  {
    title: 'Potluck, organized',
    description:
      'See what everyone is bringing, claim a category, and never accidentally end up with seven pasta salads.',
    emoji: '🥗',
    bgClass: 'bg-sage/20',
  },
  {
    title: 'Photos that travel',
    description:
      'Share candid moments from the day. Grandma will finally see the blurry cannonball photo.',
    emoji: '📸',
    bgClass: 'bg-sunlight/30',
  },
  {
    title: 'Stay in the loop',
    description: 'Get gentle reminders before the big day. No spam, just the things that matter.',
    emoji: '🔔',
    bgClass: 'bg-sage/20',
  },
  {
    title: 'Your whole household',
    description:
      'Manage the whole family in one place — kids, cousins, plus-ones, all accounted for.',
    emoji: '👨‍👩‍👧‍👦',
    bgClass: 'bg-terracotta/15',
  },
  {
    title: 'Allergies respected',
    description:
      'Note dietary needs once and we&apos;ll make sure the host knows. Nobody should go hungry.',
    emoji: '🌿',
    bgClass: 'bg-sage/20',
  },
];
