'use client';

import { ReactNode, Suspense, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from '~/components/ui/Tabs';
import { EventAnchorNav } from './EventAnchorNav';
import { EventItinerarySection, type ItineraryItem } from './EventItinerarySection';
import { EventAdditionalInfoSection } from './EventAdditionalInfoSection';
import { type GalleryPhoto } from './EventGallerySection';
import { EVENT_TAB_KEYS, type EventTabKey } from '~/lib/event-tabs';

function isEventTabKey(value: string | null): value is EventTabKey {
  return value !== null && (EVENT_TAB_KEYS as readonly string[]).includes(value);
}

interface EventTabsProps {
  eventId: string;
  /** Initial tab derived server-side from `?tab=`. */
  initialTab: EventTabKey;
  headerPanel: ReactNode;
  itineraryItems: ItineraryItem[];
  additionalInfo: string | null;
  photos?: GalleryPhoto[];
  eventName?: string;
  /**
   * Caller's user id and role.
   */
  userId?: string | null;
  userRole?: string | null;
}

/**
 * FPP-46: section-level tab control for `/events/[id]`.
 *
 * - Desktop (`md+`): renders the in-page tablist from `~/components/ui/Tabs`
 *   with proper keyboard navigation and ARIA wiring. Tab switches update
 *   `?tab=<key>` in the URL (via `router.replace`, no scroll).
 * - Mobile (`<md`): renders a horizontal scroll-anchor strip from
 *   `EventAnchorNav` plus every panel inline so guests scroll past
 *   the sections like a long landing page. Anchor clicks update the
 *   URL hash so the back button + refresh preserve the section.
 *
 * The `useSearchParams` call lives in `EventTabsContent` and is wrapped
 * in `<Suspense>` so Next.js can statically prerender the surrounding
 * page shell without blocking on the hook during partial prerendering.
 * Until the hook resolves, the `initialTab` value (read from the server
 * on the same render) is used as the active tab.
 */
export function EventTabs(props: EventTabsProps) {
  return (
    <Suspense fallback={<EventTabsFallback {...props} />}>
      <EventTabsContent {...props} />
    </Suspense>
  );
}

function EventTabsContent({
  initialTab,
  headerPanel,
  itineraryItems,
  additionalInfo,
}: EventTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlTab = searchParams.get('tab');
  const activeTab: EventTabKey = isEventTabKey(urlTab) ? urlTab : initialTab;

  const handleTabChange = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key === 'header') {
        params.delete('tab');
      } else {
        params.set('tab', key);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const tabs = useMemo(
    () => [
      {
        key: 'header' as const,
        label: 'Overview',
        panel: headerPanel,
      },
      {
        key: 'itinerary' as const,
        label: 'Itinerary',
        panel: <EventItinerarySection items={itineraryItems} />,
      },
      {
        key: 'additional-info' as const,
        label: 'Additional Info',
        panel: <EventAdditionalInfoSection body={additionalInfo} />,
      },
    ],
    [headerPanel, itineraryItems, additionalInfo],
  );

  const anchorItems = tabs.map((t) => ({
    key: t.key,
    label: t.label,
    anchorId: `event-section-${t.key}`,
  }));

  return (
    <>
      <div className="hidden md:block">
        <Tabs
          tabs={tabs}
          value={activeTab}
          onValueChange={handleTabChange}
          ariaLabel="Event overview sections"
          listClassName="w-full"
        />
      </div>
      <div className="md:hidden">
        <EventAnchorNav
          items={anchorItems}
          value={activeTab}
          onValueChange={handleTabChange}
          ariaLabel="Jump to event section"
        />
        <div className="mt-8 space-y-12">
          {tabs.map((tab) => (
            <section
              key={tab.key}
              id={`event-section-${tab.key}`}
              aria-label={typeof tab.label === 'string' ? tab.label : undefined}
            >
              {tab.panel}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Suspense fallback. Renders every panel inline so the static shell
 * is on screen while the client-only `useSearchParams` boundary
 * resolves. Mirrors the mobile layout because that path doesn't
 * depend on the URL — guests who land on a cached render still see
 * all sections stacked, and the client takes over after hydrate.
 */
function EventTabsFallback({
  initialTab,
  headerPanel,
  itineraryItems,
  additionalInfo,
}: EventTabsProps) {
  return (
    <div className="space-y-12">
      <div className="border-border bg-card/60 inline-flex flex-wrap items-center gap-1 rounded-sm border p-1 text-sm opacity-60 shadow-sm backdrop-blur">
        <span className="bg-foreground text-background rounded-sm px-4 py-2 font-semibold">
          {labelFor(initialTab)}
        </span>
        {EVENT_TAB_KEYS.filter((k) => k !== initialTab).map((k) => (
          <span
            key={k}
            className="text-muted-foreground rounded-sm px-4 py-2 font-medium"
            aria-hidden="true"
          >
            {labelFor(k)}
          </span>
        ))}
      </div>
      <div className="space-y-12">
        <section aria-label="Overview">{headerPanel}</section>
        <section aria-label="Itinerary">
          <EventItinerarySection items={itineraryItems} />
        </section>
        <section aria-label="Additional Info">
          <EventAdditionalInfoSection body={additionalInfo} />
        </section>
      </div>
    </div>
  );
}

function labelFor(key: EventTabKey): string {
  switch (key) {
    case 'header':
      return 'Overview';
    case 'itinerary':
      return 'Itinerary';
    case 'additional-info':
      return 'Additional Info';
  }
}
