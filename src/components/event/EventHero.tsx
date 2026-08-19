import { BreatheSection } from '~/components/ui/BreatheSection';

export interface EventHeroProps {
  name: string;
  featuredImageUrl?: string | null;
  mapImageUrl?: string | null;
  /**
   * "default" matches the main event detail page (55vh / 40vh on md+).
   * "compact" is the smaller variant used by the Potluck and Gallery
   * tabs so they keep a recognizable event header without dwarfing
   * the actual content below.
   */
  size?: 'default' | 'compact';
  /**
   * Event publication status. Drives the small floating badge in
   * the top corner of the hero. Only shown in the default size —
   * the compact variant drops it to keep the visual quiet.
   */
  status?: string;
  /** Renders the "Past gathering" badge when true. */
  isPast?: boolean;
}

export default function EventHero({
  name,
  featuredImageUrl,
  mapImageUrl,
  size = 'default',
  status,
  isPast = false,
}: EventHeroProps) {
  const isCompact = size === 'compact';

  const containerClassName = isCompact
    ? 'relative -mt-[73px] h-[28vh] min-h-[200px] w-full overflow-hidden md:h-[24vh]'
    : 'relative -mt-[73px] h-[55vh] min-h-[420px] w-full overflow-hidden md:h-[40vh]';

  const heroImage = featuredImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={featuredImageUrl} alt={name} className="h-full w-full object-cover" />
  ) : mapImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mapImageUrl} alt={name} className="h-full w-full object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/lake-banner.jpg" alt="" className="h-full w-full object-cover" />
  );

  const gradient = isCompact ? (
    <div className="from-foreground/30 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
  ) : (
    <div className="from-foreground/40 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
  );

  // The default hero wraps in BreatheSection to play the fade-in
  // animation. The compact variant (Potluck / Gallery) skips the
  // animation — it shows up right when the page paints, which feels
  // snappier than waiting for an IntersectionObserver tick.
  const inner = (
    <>
      {/* FPP-60: hero precedence is featuredImageUrl -> mapImageUrl
          -> default banner. The featured image is whatever the
          host uploaded through the admin form; the map preview is
          the legacy fallback (QUB-15); the banner is the
          pre-map default. The static-map fallback intentionally
          remains so existing events without a featured image keep
          rendering exactly as before this ticket. */}
      {heroImage}
      {gradient}

      {/* Status + "Past gathering" badges only on the default
          variant — the compact hero keeps the chrome minimal. */}
      {!isCompact && status !== undefined && (
        <div className="absolute top-5 right-5 left-5 flex flex-wrap items-center justify-between gap-3">
          <div className="shadow-soft inline-flex items-center gap-2 rounded-sm border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
            <span className="bg-sunlight h-2 w-2 rounded-sm shadow-[0_0_10px_var(--sunlight)]" />
            {status === 'PUBLISHED'
              ? 'Invitation Open'
              : status === 'CANCELLED'
                ? 'Cancelled'
                : status.charAt(0) + status.slice(1).toLowerCase()}
          </div>
          {isPast && (
            <div className="bg-foreground/80 text-background rounded-sm px-4 py-2 text-sm font-medium backdrop-blur-md">
              Past gathering
            </div>
          )}
        </div>
      )}

      <div
        className={
          isCompact
            ? 'absolute right-4 bottom-3 left-4 md:right-8 md:bottom-5 md:left-8'
            : 'absolute right-6 bottom-6 left-6 md:right-20 md:bottom-20 md:left-20'
        }
      >
        <div className={isCompact ? 'max-w-3xl' : 'max-w-4xl'}>
          <h1
            className={
              isCompact
                ? 'font-display text-2xl leading-tight font-medium tracking-tight text-white drop-shadow-md md:text-3xl'
                : 'font-display text-4xl leading-[1.05] font-medium tracking-tight text-white drop-shadow-lg md:text-6xl'
            }
          >
            {name}
          </h1>
        </div>
      </div>
    </>
  );

  if (isCompact) {
    return <div className={containerClassName}>{inner}</div>;
  }

  return <BreatheSection className={containerClassName}>{inner}</BreatheSection>;
}
