import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-46: convert the event overview page to a tabbed layout.
 *
 * Structural assertions that lock in the tabbed layout contract:
 *   - desktop uses an ARIA tablist with keyboard navigation
 *   - mobile swaps to scroll-anchor navigation
 *   - the four sections (Header / Itinerary / Additional Info / Gallery)
 *     exist as dedicated components that the overview page delegates to
 *   - tab switches update `?tab=<key>` for deep linking
 *
 * The component-level behaviour (URL sync, scroll, keyboard nav) is
 * covered in `src/components/ui/__tests__/Tabs.test.tsx` and
 * `src/components/event/__tests__/EventTabs.test.tsx`.
 */
describe('FPP-46: event overview tabbed layout', () => {
  const tabsPath = path.join(process.cwd(), 'src/components/ui/Tabs.tsx');
  const anchorNavPath = path.join(process.cwd(), 'src/components/event/EventAnchorNav.tsx');
  const eventTabsPath = path.join(process.cwd(), 'src/components/event/EventTabs.tsx');
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

    it('orchestrates desktop tabs vs mobile anchors via viewport-aware layout', async () => {
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      expect(content).toContain('hidden md:block');
      expect(content).toContain('md:hidden');
      expect(content).toContain('<Tabs');
      expect(content).toContain('<EventAnchorNav');
    });

    it('syncs the active tab to ?tab=<key> via router.replace', async () => {
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      expect(content).toMatch(/searchParams\.get\(['"]tab['"]\)/);
      expect(content).toMatch(/router\.replace/);
      expect(content).toMatch(/params\.set\(['"]tab['"]/);
    });

    it('mounts the four sections declared by FPP-46 (Header / Itinerary / Additional Info / Gallery)', async () => {
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      expect(content).toContain('<EventItinerarySection');
      expect(content).toContain('<EventAdditionalInfoSection');
      expect(content).toContain('<EventGallerySection');
      // The Header section is passed in as a pre-rendered panel so the
      // parent page can decide what data it receives.
      expect(content).toContain('headerPanel');
    });

    it('reads the initial tab from server-side searchParams', async () => {
      const content = await fs.readFile(eventPagePath, 'utf-8');
      expect(content).toContain('searchParams');
      expect(content).toContain('resolveInitialTab');
      expect(content).toContain('initialTab=');
    });

    it('threads the viewer userId + role through to the Gallery panel', async () => {
      // FPP-46 review fix #1: PhotoCard needs userId / userRole for
      // reaction + delete affordances. The page must fetch userRole
      // (it was dropped during the refactor) and pass both into the
      // tabs orchestrator so the Gallery tab is interactive.
      const tabsContent = await fs.readFile(eventTabsPath, 'utf-8');
      expect(tabsContent).toMatch(/userId:\s*string\s*\|\s*null/);
      expect(tabsContent).toMatch(/userRole:\s*string\s*\|\s*null/);
      // The Gallery panel must NOT hardcode null for either field.
      expect(tabsContent).not.toMatch(/userId=\{null\}/);
      expect(tabsContent).not.toMatch(/userRole=\{null\}/);

      const pageContent = await fs.readFile(eventPagePath, 'utf-8');
      expect(pageContent).toMatch(/prisma\.user[\s\S]*?findUnique[\s\S]*?role:\s*true/);
      expect(pageContent).toContain('userId={userId}');
      expect(pageContent).toMatch(/userRole=\{userRole\s*\?\?\s*null\}/);
    });

    it('wraps the useSearchParams() consumer in a Suspense boundary', async () => {
      // FPP-46 review fix #2: Next.js 14+ requires <Suspense> around
      // any component that reads useSearchParams() so the page can
      // statically prerender. EventTabs keeps the public API but
      // delegates the hook call to an inner component behind
      // <Suspense> with a fallback that renders every panel.
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      expect(content).toContain('<Suspense');
      expect(content).toContain('EventTabsContent');
      expect(content).toContain('EventTabsFallback');
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

    it('hosts the host block + potluck preview + meta strip', async () => {
      const content = await fs.readFile(headerSectionPath, 'utf-8');
      expect(content).toContain('A note from the host');
      expect(content).toContain('eventDescription');
      expect(content).toContain('PotluckPreview');
      expect(content).toContain('MetaStrip');
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

    it('supports a minimal inline markdown (bold / italic / code / links / lists)', async () => {
      const content = await fs.readFile(additionalInfoSectionPath, 'utf-8');
      expect(content).toMatch(/\*\*[^*]+\*\*/);
      expect(content).toMatch(/\[([^\]]+)\]\(([^)]+)\)/);
      expect(content).toContain('list-disc');
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
