import EmptyState from '~/components/ui/EmptyState';

export interface ItineraryItem {
  /** Stable id; falls back to index for the placeholder set until QUB-31 ships. */
  id?: string;
  /** Optional display time, formatted in the event's timezone. */
  time: string | null;
  title: string;
  description: string | null;
}

export interface EventItinerarySectionProps {
  /**
   * Items ordered by `order` ascending, then by `time` ascending. The
   * current detail page passes the placeholder set until QUB-31.3
   * adds the `ItineraryItem` model + admin CRUD. Once the model lands
   * and items are stored in the event's timezone, render the times
   * through `Intl.DateTimeFormat` with `timeZone` so guests in other
   * timezones see the same wall-clock time as the host.
   */
  items: ItineraryItem[];
}

/**
 * FPP-46 / FPP-9: Itinerary tab content. Renders the event's
 * itinerary items (time, title, description) in the order provided
 * by the caller. Shows a friendly empty state when there are no
 * items so the tab is never blank.
 */
export function EventItinerarySection({ items }: EventItinerarySectionProps) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">The day</p>
          <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
            Itinerary
          </h2>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="list"
            title="The schedule is still being planned"
            description="The host will share the day's flow soon. Check back as the gathering approaches."
          />
        </div>
      ) : (
        <ol className="mt-6 space-y-3" data-testid="event-itinerary-list">
          {items.map((item, idx) => (
            <li
              key={item.id ?? `itinerary-${idx}`}
              className="bg-card shadow-card ring-border/60 flex items-center gap-5 rounded-2xl p-5 ring-1"
              data-testid="event-itinerary-item"
            >
              {item.time ? (
                <ItineraryTimeBadge time={item.time} />
              ) : (
                <div className="bg-secondary flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl">
                  <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                    Soon
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-display text-foreground text-lg font-semibold">{item.title}</h3>
                {item.description && (
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ItineraryTimeBadge({ time }: { time: string }) {
  // Split "10:00 AM" → ["10:00", "AM"] so we can render the numeric
  // portion bigger than the meridian. Defensive: a single-token
  // string (e.g. "10:00") just renders as one block.
  const [numeric, meridian] = time.split(/\s+/);
  return (
    <div className="bg-sage/15 flex shrink-0 flex-col items-center justify-center rounded-2xl px-4 py-3 text-center">
      <span className="font-display text-foreground text-lg font-semibold">{numeric}</span>
      {meridian && <span className="text-muted-foreground text-xs font-semibold">{meridian}</span>}
    </div>
  );
}
