import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-154: convert the event overview page to a continuous-scroll
 * layout (formerly FPP-46's tabbed shell).
 *
 * Structural assertions that lock in the new architecture:
 *   - the page renders every section (Overview / Itinerary /
 *     Additional Info) as a stacked <section> with an anchor id
 *   - the EventAnchorNav sits above the sections so guests can jump
 *     between them via #event-section-<key> hash links
 *   - no desktop-vs-mobile viewport branching remains in
 *     EventSectionTabs — the SPA-style layout is the same everywhere
 *   - URL deep links flow through native hash anchors, NOT a `?tab=`
 *     query string and NOT router.replace calls inside the component
 *   - the page no longer reads a `tab` query param; the previous
 *     `?tab=<key>` shell is fully removed
 *
 * Component-level behaviour (scroll spy, URL hash writes) lives in
 * `src/components/event/__tests__/EventSectionTabs.test.tsx` and
 * `src/components/event/__tests__/EventAnchorNav.test.tsx`.
 */
describe('FPP-154: event overview continuous-scroll layout', () => {
  const tabsPath = path.join(process.cwd(), 'src/components/ui/Tabs.tsx');
  const anchorNavPath = path.join(process.cwd(), 'src/components/event/EventAnchorNav.tsx');
  const eventTabsPath = path.join(process.cwd(), 'src/components/event/EventSectionTabs.tsx');
  const eventPagePath = path.join(process.cwd(), 'src/app/events/[id]/page.tsx');
  const headerSectionPath = path.join(process.cwd(), 'src/components/event/EventHeaderSection.tsx');
  const itinerarySectionPath = path.join(
    process.cwd(),
    'src/components/event/EventItinerarySection.tsx',
  );
  const additionalInfoSectionPath = path.join(
    process.cwd(),
    'src/components/event/EventAdditionalInfoSection.tsx',
  );
  const gallerySectionPath = path.join(
    process.cwd(),
    'src/components/event/EventGallerySection.tsx',
  );

  describe('FPP-11 — tabbed layout shell', () => {
    it('exposes a reusable Tabs primitive with ARIA roles and keyboard nav', async () => {
      const content = await fs.readFile(tabsPath, 'utf-8');
      expect(content).toContain('role="tablist"');
      expect(content).toContain('role="tab"');
      expect(content).toContain('role="tabpanel"');
      expect(content).toContain('aria-selected');
      expect(content).toContain('aria-controls');
      expect(content).toContain('aria-labelledby');
      // Arrow / Home / End keyboard nav per WAI-ARIA Authoring Practices.
      expect(content).toMatch(/ArrowRight/);
      expect(content).toMatch(/ArrowLeft/);
      expect(content).toMatch(/'Home'/);
      expect(content).toMatch(/'End'/);
    });

    it('exposes a separate EventAnchorNav for mobile scroll anchors', async () => {
      const content = await fs.readFile(anchorNavPath, 'utf-8');
      expect(content).toContain('aria-label');
      expect(content).toMatch(/scrollIntoView/);
    });

    it('orchestrates a single SPA-style stacked layout — no desktop vs mobile fork', async () => {
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      // The previous viewport-aware branching ("hidden md:block" +
      // "md:hidden" wrappers around two different render trees) is gone.
      expect(content).not.toContain('hidden md:block');
      expect(content).not.toContain('md:hidden');
      // A single EventAnchorNav now sits above the stacked sections
      // for every viewport.
      expect(content).toContain('<EventAnchorNav');
      // The Tabs primitive is no longer mounted on the event page.
      expect(content).not.toContain('<Tabs');
    });

    it('does NOT sync any active tab to a ?tab=<key> URL param', async () => {
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      // URL syncing was the contract under the old tabbed shell —
      // continuous scroll uses native #hash anchors instead.
      expect(content).not.toMatch(/searchParams\.get\(['"]tab['"]\)/);
      expect(content).not.toMatch(/router\.replace/);
      expect(content).not.toMatch(/params\.set\(['"]tab['"]\)/);
    });

    it('mounts the sections declared by EventSectionTabs (Header / Itinerary / Additional Info) with Gallery removed per FPP-135', async () => {
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      expect(content).toContain('<EventItinerarySection');
      expect(content).toContain('<EventAdditionalInfoSection');
      expect(content).not.toContain('<EventGallerySection');
      // The Header section is passed in as a pre-rendered panel so the
      // parent page can decide what data it receives.
      expect(content).toContain('headerPanel');
    });

    it('does NOT read an initial tab from server-side searchParams', async () => {
      // FPP-154: continuous scroll renders every section every render,
      // so the page no longer needs to know which tab the user started
      // on. The old `?tab=` plumbing is removed end-to-end.
      const content = await fs.readFile(eventPagePath, 'utf-8');
      expect(content).not.toMatch(/searchParams\s*:\s*Promise/);
      expect(content).not.toContain('resolveInitialTab');
      expect(content).not.toContain('initialTab=');
    });

    it('still wraps the section content in a Suspense boundary for safe prerender', async () => {
      // FPP-46 review fix #2 originally required <Suspense> around any
      // component that reads useSearchParams(). FPP-154 keeps the
      // boundary as a defensive measure so future client-only state
      // (e.g. scroll-spy in the anchor nav) can land without re-shaping
      // the page shell.
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      expect(content).toContain('<Suspense');
      expect(content).toContain('EventSectionTabsContent');
      expect(content).toContain('EventSectionTabsFallback');
    });
  });

  describe('FPP-10 — Header tab content', () => {
    it('renders a Welcome heading and the event name as subtitle', async () => {
      const content = await fs.readFile(headerSectionPath, 'utf-8');
      expect(content).toMatch(/Welcome/);
      expect(content).toMatch(/eventName/);
    });

    it('embeds the RSVP card so users can RSVP / edit attendance from the Header tab', async () => {
      const content = await fs.readFile(headerSectionPath, 'utf-8');
      expect(content).toContain('<EventRsvpCard');
      // The card handles the "Edit RSVP" branch when the user is
      // already confirmed; we don't duplicate the wording here.
      expect(content).toMatch(/existingRsvp/);
    });

    it('hosts the host block + meta strip', async () => {
      const content = await fs.readFile(headerSectionPath, 'utf-8');
      expect(content).toContain('A note from the host');
      expect(content).toContain('eventDescription');
      expect(content).toContain('MetaStrip');
    });

    it('FPP-140: consolidates date, time, and location prominently under event title', async () => {
      const content = await fs.readFile(headerSectionPath, 'utf-8');
      expect(content).toMatch(/toLocaleDateString/);
      expect(content).toMatch(/toLocaleTimeString/);
      expect(content).toMatch(/eventLocation/);
    });

    it('FPP-139: potluck slider preview is removed from Overview tab', async () => {
      const content = await fs.readFile(headerSectionPath, 'utf-8');
      expect(content).not.toContain('PotluckPreview');
    });
  });

  describe('FPP-9 — Itinerary tab content', () => {
    it('renders itinerary items with a time, title, and description', async () => {
      const content = await fs.readFile(itinerarySectionPath, 'utf-8');
      expect(content).toContain('time');
      expect(content).toContain('title');
      expect(content).toContain('description');
    });

    it('falls back to a friendly empty state when there are no items', async () => {
      const content = await fs.readFile(itinerarySectionPath, 'utf-8');
      expect(content).toContain('EmptyState');
      expect(content).toMatch(/items\.length === 0/);
    });

    it('FPP-45: reads itinerary items from the database, ordered by (order, time)', async () => {
      const content = await fs.readFile(eventPagePath, 'utf-8');
      // The page must pull rows from the ItineraryItem table rather
      // than rendering a static placeholder. The acceptance criterion
      // is "Items shown in stored order", so the query must order
      // by `order` ascending with a time tie-break.
      expect(content).toContain('itineraryItems:');
      expect(content).toMatch(/orderBy:\s*\[\{ order: 'asc' \}, \{ time: 'asc' \}\]/);
      // The placeholder array is gone — FPP-45 ships the real model.
      expect(content).not.toContain('PLACEHOLDER_ITINERARY');
    });
  });

  describe('FPP-8 — Additional Info tab content', () => {
    it('hides its empty state per the ticket copy', async () => {
      const content = await fs.readFile(additionalInfoSectionPath, 'utf-8');
      // The empty state is a single muted line rather than a card so
      // the tab body is "hidden" rather than a noisy placeholder.
      expect(content).toContain('Nothing extra to share yet');
      // No EmptyState component is rendered when the body is empty.
      expect(content).not.toContain('<EmptyState');
    });

    it('renders sanitized TipTap-style rich text (bold / italic / links / lists)', async () => {
      const content = await fs.readFile(additionalInfoSectionPath, 'utf-8');
      expect(content).toContain("from '~/lib/sanitize-html'");
      expect(content).toContain('sanitizeRichText');
      expect(content).toContain('dangerouslySetInnerHTML');
      expect(content).toContain('rich-text-content');
    });

    it('receives the event additional-info body as a prop', async () => {
      const content = await fs.readFile(additionalInfoSectionPath, 'utf-8');
      expect(content).toContain('body');
      expect(content).toContain('body: string | null');
    });
  });

  describe('FPP-7 — Gallery tab content', () => {
    it('renders the photo grid with no date-range filter (per QUB-27)', async () => {
      const content = await fs.readFile(gallerySectionPath, 'utf-8');
      expect(content).toContain('<PhotoCard');
      expect(content).toContain('grid');
      // No date-range filter UI is rendered.
      expect(content).not.toMatch(/date[_-]?range/i);
      expect(content).not.toContain('DateRangePicker');
    });

    it('falls back to a friendly empty state when no photos are shared yet', async () => {
      const content = await fs.readFile(gallerySectionPath, 'utf-8');
      expect(content).toContain('EmptyState');
      expect(content).toContain('No photos yet');
    });

    it('pulls photos from the existing page-level prisma include (no router change)', async () => {
      const content = await fs.readFile(eventPagePath, 'utf-8');
      expect(content).toContain('photos:');
      expect(content).toContain('deletedAt: null');
    });
  });
});
