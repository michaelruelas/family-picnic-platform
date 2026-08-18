'use client';

import { ReactNode, Suspense, useMemo } from 'react';
import { EventAnchorNav, type AnchorNavItem } from './EventAnchorNav';
import { EventItinerarySection, type ItineraryItem } from './EventItinerarySection';
import { EventAdditionalInfoSection } from './EventAdditionalInfoSection';
import { PublicAttendeeList } from './PublicAttendeeList';
import { type PublicEventAttachment } from './EventDownloadsSection';

/**
 * FPP-151: public-safe household-grouped attendance list. The
 * `attendingFirstNames` array contains only the *first* token of each
 * member's stored name (e.g. "Maria Garcia" -> "Maria") so the public
 * surface never exposes full names or contact info.
 */
export interface PublicAttendee {
  householdName: string;
  attendingFirstNames: string[];
}

interface EventSectionTabsProps {
  eventId: string;
  /** The Overview panel — typically a fully-built <EventHeaderSection>. */
  headerPanel: ReactNode;
  itineraryItems: ItineraryItem[];
  additionalInfo: string | null;
  /** FPP-137: PDF attachments rendered inside the Additional Info section. */
  attachments?: PublicEventAttachment[];
  /**
   * FPP-151: Who's coming list. When provided and non-empty, a
   * dedicated "Who's coming" section surfaces between Itinerary
   * and Additional Info. Omit (or pass an empty array) to hide
   * the section entirely so early-lifecycle events stay quiet.
   */
  publicAttendees?: PublicAttendee[];
  eventName: string;
  /**
   * Caller's user id and role. Reserved for future scroll-spy
   * highlighting (e.g. hiding RSVP-CTA in past sections).
   */
  userId?: string | null;
  userRole?: string | null;
}

/**
 * FPP-154: continuous-scroll event overview (formerly FPP-46's tabbed
 * shell). The Overview / Itinerary / Additional Info blocks stack as
 * a single long page on every viewport. An anchor nav at the top lets
 * guests jump to any section.
 *
 * URL deep links use the native `#event-section-{key}` hash:
 * - `/#event-section-itinerary` lands at the Itinerary block
 * - the anchor nav updates `window.location.hash` on click so the
 *   back button + refresh preserve the section
 *
 * No `?tab=` URL param is read or written — a tabbed shell is no
 * longer in play. The Suspense boundary stays around the entire
 * surface so Next.js can prerender the surrounding page shell without
 * blocking on the client-only anchor handler.
 */
export function EventSectionTabs(props: EventSectionTabsProps) {
  return (
    <Suspense fallback={<EventSectionTabsFallback {...props} />}>
      <EventSectionTabsContent {...props} />
    </Suspense>
  );
}

function EventSectionTabsContent({
  eventId,
  headerPanel,
  itineraryItems,
  additionalInfo,
  attachments,
  publicAttendees,
}: EventSectionTabsProps) {
  const sections = useMemo<Array<{ key: string; label: string; panel: ReactNode }>>(() => {
    // FPP-151: surface the "Who's coming" section only when at
    // least one household has confirmed attendance. Inserted
    // between Itinerary and Additional Info so the discoverable
    // order reads "what is it → when → who's in → notes".
    const base: Array<{ key: string; label: string; panel: ReactNode }> = [
      {
        key: 'header',
        label: 'Overview',
        panel: headerPanel,
      },
      {
        key: 'itinerary',
        label: 'Itinerary',
        panel: <EventItinerarySection items={itineraryItems} />,
      },
    ];
    if (publicAttendees && publicAttendees.length > 0) {
      base.push({
        key: 'attendees',
        label: "Who's coming",
        panel: <PublicAttendeeList attendees={publicAttendees} />,
      });
    }
    base.push({
      key: 'additional-info',
      label: 'Additional Info',
      panel: <EventAdditionalInfoSection body={additionalInfo} attachments={attachments ?? []} />,
    });
    return base;
  }, [headerPanel, itineraryItems, additionalInfo, attachments, publicAttendees]);

  const anchorItems: AnchorNavItem[] = sections.map((s) => ({
    key: s.key,
    label: s.label,
    anchorId: `event-section-${s.key}`,
  }));

  return (
    <div data-event-id={eventId}>
      <EventAnchorNav items={anchorItems} ariaLabel="Jump to event section" className="mb-8" />
      <div className="space-y-12">
        {sections.map((section) => (
          <section
            key={section.key}
            id={`event-section-${section.key}`}
            aria-label={section.label}
            className="scroll-mt-24"
          >
            <h2 className="font-display sr-only">{section.label}</h2>
            {section.panel}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Suspense fallback. Renders every section inline (no anchor nav,
 * which depends on a client-side scroll handler). The static shell
 * stays on screen until hydration so guests who land on a cached
 * render see the full page regardless of viewport.
 */
function EventSectionTabsFallback({
  headerPanel,
  itineraryItems,
  additionalInfo,
  attachments,
  publicAttendees,
}: EventSectionTabsProps) {
  return (
    <div className="space-y-12">
      <section aria-label="Overview">{headerPanel}</section>
      <section aria-label="Itinerary">
        <EventItinerarySection items={itineraryItems} />
      </section>
      {publicAttendees && publicAttendees.length > 0 && (
        <section aria-label="Who's coming">
          <PublicAttendeeList attendees={publicAttendees} />
        </section>
      )}
      <section aria-label="Additional Info">
        <EventAdditionalInfoSection body={additionalInfo} attachments={attachments ?? []} />
      </section>
    </div>
  );
}
