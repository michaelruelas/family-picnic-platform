import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-4 / QUB-31.3 — render itinerary items on the event page Itinerary tab.
 *
 * Acceptance criteria:
 *   1. Itinerary renders in the event page Itinerary tab (QUB-30.3).
 *   2. Items shown in stored order.
 *
 * These are structural assertions that lock in the wiring between
 * the page-level Prisma query, the `EventTabs` orchestrator, and the
 * `EventItinerarySection` rendering component. The runtime behaviour
 * (rendering time / title / description, empty state, in-order
 * rendering) is covered in
 * `src/components/event/__tests__/EventItinerarySection.test.tsx`.
 *
 * The data-model side (table shape, indexes) is locked in by
 * `prisma/__tests__/schema-integrity.test.ts`; the admin-side CRUD is
 * covered by FPP-5 / QUB-31.2 tests.
 */
describe('FPP-4: render itinerary on the event page', () => {
  const eventPagePath = path.join(process.cwd(), 'src/app/events/[id]/page.tsx');
  const eventTabsPath = path.join(process.cwd(), 'src/components/event/EventTabs.tsx');
  const itinerarySectionPath = path.join(
    process.cwd(),
    'src/components/event/EventItinerarySection.tsx',
  );
  const itineraryTimePath = path.join(process.cwd(), 'src/lib/itinerary-time.ts');
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');

  describe('AC1 — Itinerary renders in the event page Itinerary tab', () => {
    it('event page queries the ItineraryItem table (no placeholder array)', async () => {
      const content = await fs.readFile(eventPagePath, 'utf-8');
      // The page pulls rows from the ItineraryItem table via the
      // prisma include rather than rendering a hardcoded set.
      expect(content).toMatch(/itineraryItems:\s*\{/);
      // Sanity-check: the old FPP-46 placeholder is gone.
      expect(content).not.toContain('PLACEHOLDER_ITINERARY');
    });

    it('EventTabs mounts EventItinerarySection on the itinerary tab', async () => {
      const content = await fs.readFile(eventTabsPath, 'utf-8');
      // The itinerary tab key is wired to the section component.
      expect(content).toContain("key: 'itinerary'");
      expect(content).toMatch(/label:\s*['"]Itinerary['"]/);
      expect(content).toMatch(/panel:\s*<EventItinerarySection/);
    });

    it('EventItinerarySection renders time, title, and description per row', async () => {
      const content = await fs.readFile(itinerarySectionPath, 'utf-8');
      expect(content).toMatch(/\btime\b/);
      expect(content).toMatch(/\btitle\b/);
      expect(content).toMatch(/\bdescription\b/);
      // Empty state so the tab is never blank for a hostless event.
      expect(content).toMatch(/items\.length === 0/);
      expect(content).toContain('EmptyState');
    });

    it('event page formats stored HH:MM:SS time into 12-hour display via formatItineraryTime', async () => {
      // The DB stores wall-clock 24h strings (e.g. "14:30"). The page
      // converts each row's time into "2:30 PM" before handing the
      // array to the section component, so guests see the host's
      // intended wall-clock reading.
      const itineraryTime = await fs.readFile(itineraryTimePath, 'utf-8');
      expect(itineraryTime).toContain('export function formatItineraryTime');
      const page = await fs.readFile(eventPagePath, 'utf-8');
      expect(page).toContain('formatItineraryTime');
      expect(page).toMatch(
        /time:\s*item\.time\s*\?\s*formatItineraryTime\(item\.time\)\s*:\s*null/,
      );
    });
  });

  describe('AC2 — Items shown in stored order', () => {
    it('event page sorts itineraryItems by (order asc, time asc)', async () => {
      // Stored order is `order` (the stable display order set by
      // drag-to-reorder). `time` is the tie-break so two rows that
      // share a wall-clock time still surface deterministically
      // when the host hasn't customized `order`.
      const content = await fs.readFile(eventPagePath, 'utf-8');
      expect(content).toMatch(/orderBy:\s*\[\{\s*order:\s*'asc'\s*\},\s*\{\s*time:\s*'asc'\s*\}\]/);
    });

    it('ItineraryItem schema exposes the `order` column used for stored ordering', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      // The column is declared.
      expect(schema).toMatch(/\border\s+Int\b/);
      // Composite index on (eventId, order) backs the public list
      // query and the admin reorder query.
      expect(schema).toContain('@@index([eventId, order])');
    });

    it('the migration that created ItineraryItem ordered its composite index by (eventId, order)', async () => {
      // Schema can drift from migrations; the canonical index name
      // lives in the SQL file. Pin to the exact FPP-45 / QUB-31.1
      // migration directory so a future unrelated directory whose
      // name happens to contain "itinerary" does not silently
      // satisfy this assertion.
      const migrationPath = path.join(
        process.cwd(),
        'prisma/migrations',
        '20260808180158_fpp45_itinerary_items',
        'migration.sql',
      );
      const sql = await fs.readFile(migrationPath, 'utf-8');
      expect(sql).toContain('ItineraryItem_eventId_order_idx');
    });

    it('EventItinerarySection renders rows in the array order it is given', async () => {
      // The section component is presentational and does not re-sort
      // its input — stored order is set by the page query and the
      // section trusts it. This assertion is the source-of-truth
      // contract that the matching unit test pins at runtime.
      const content = await fs.readFile(itinerarySectionPath, 'utf-8');
      expect(content).toMatch(/items\.map\(/);
      // No re-sort on the items prop. Match the specific call site
      // (`items.sort(`) rather than any `.sort(` token so a comment
      // like `// don't .sort() here` does not false-positive.
      expect(content).not.toMatch(/items\.sort\(/);
    });
  });
});
