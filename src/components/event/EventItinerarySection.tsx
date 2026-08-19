import EmptyState from '~/components/ui/EmptyState';

export interface ItineraryItem {
  /** Stable id from the itinerary_items table. */
  id: string;
  /**
   * Wall-clock time formatted as "10:00 AM" in the event's
   * timezone. The host enters the time once in the admin editor
   * (QUB-31.2) and that string is stored on `ItineraryItem.time`
   * as HH:MM(:SS); the page formats it for display so guests in
   * other timezones see the host's intended wall-clock reading.
   */
  time: string | null;
  title: string;
  description: string | null;
}

export interface EventItinerarySectionProps {
  /**
   * Items in the order set by the admin editor (i.e. by
   * `ItineraryItem.order` ascending, with `time` as the tie-break).
   * The detail page queries the items ordered by `[{ order: 'asc' },
   * { time: 'asc' }]` and pre-formats the wall-clock time, so this
   * component just renders what it's given.
   */
  items: ItineraryItem[];
}

/**
 * FPP-46 / FPP-45: Itinerary tab content. Renders the event's
 * itinerary items (time, title, description) in the order provided
 * by the caller. Shows a friendly empty state when there are no
 * items so the tab is never blank.
 */
export function EventItinerarySection({ items }: EventItinerarySectionProps) {
  return (
    <section>
      <h2 className="font-display text-foreground text-3xl font-medium tracking-tight md:text-4xl">
        Itinerary
      </h2>

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
          {items.map((item) => (
            <li
              key={item.id}
              className="bg-card shadow-card ring-border/60 flex items-center gap-5 rounded-sm p-5 ring-1"
              data-testid="event-itinerary-item"
            >
              {item.time ? (
                <ItineraryTimeBadge time={item.time} />
              ) : (
                <div className="bg-secondary flex h-16 w-16 shrink-0 items-center justify-center rounded-sm">
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
    <div className="bg-sage/15 flex shrink-0 flex-col items-center justify-center rounded-sm px-4 py-3 text-center">
      <span className="font-display text-foreground text-lg font-semibold">{numeric}</span>
      {meridian && <span className="text-muted-foreground text-xs font-semibold">{meridian}</span>}
    </div>
  );
}
