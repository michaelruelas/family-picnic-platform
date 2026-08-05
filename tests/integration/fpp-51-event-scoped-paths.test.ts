import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('FPP-51: Potluck and Photos live under event URLs', () => {
  describe('FPP-24: new /events/:id/potluck page', () => {
    const pagePath = path.join(process.cwd(), 'src/app/events/[id]/potluck/page.tsx');

    it('exists as a server component under the event route', async () => {
      const stat = await fs.stat(pagePath);
      expect(stat.isFile()).toBe(true);
    });

    it('renders the event-scoped potluck overview read-only', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      // The page must surface the menu and slot count, but it must
      // not host a slot-signup form. Slot signups live in the RSVP
      // form (FPP-21). The "Manage my potluck" card deep-links to
      // the RSVP form via ?openRsvp=potluck.
      expect(pageContent).toContain('Potluck');
      expect(pageContent).toContain('PotluckManageCard');
    });

    it('deep-links to the RSVP form with ?openRsvp=potluck via the manage card', async () => {
      const managePath = path.join(process.cwd(), 'src/components/potluck/PotluckManageCard.tsx');
      const cardContent = await fs.readFile(managePath, 'utf-8');
      expect(cardContent).toContain('?openRsvp=potluck');
      expect(cardContent).toContain('Edit my slots');
    });

    it('uses Prisma to fetch slots for the given event id', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      expect(pageContent).toContain('prisma.event.findUnique');
      expect(pageContent).toContain('potluckSlots');
    });
  });

  describe('FPP-24: new /events/:id/photos page', () => {
    const pagePath = path.join(process.cwd(), 'src/app/events/[id]/photos/page.tsx');

    it('exists as a server component under the event route', async () => {
      const stat = await fs.stat(pagePath);
      expect(stat.isFile()).toBe(true);
    });

    it('renders event-scoped photos', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      expect(pageContent).toContain('Photos');
      expect(pageContent).toContain('prisma.photo.findMany');
      expect(pageContent).toContain('eventId: id');
    });
  });

  describe('FPP-23: legacy /potluck redirects', () => {
    const pagePath = path.join(process.cwd(), 'src/app/potluck/page.tsx');

    it('uses permanentRedirect for a 301 to the relevant event', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      expect(pageContent).toContain('permanentRedirect');
    });

    it('redirects to the next upcoming published event with potluck slots', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      // The redirect targets /events/:id/potluck — the canonical
      // URL introduced in FPP-24. The query favours the next
      // upcoming event with at least one potluck slot.
      expect(pageContent).toContain('/events/');
      expect(pageContent).toContain('/potluck');
      expect(pageContent).toContain('date: { gte: now }');
      expect(pageContent).toContain('potluckSlots: { some: {} }');
    });

    it('renders a friendly message when no event can host the redirect', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      // Two redirect targets are attempted: the next upcoming event,
      // then the most recent past event. If neither matches, the
      // page renders a friendly "No potluck to show" card instead
      // of throwing a hard 404. FPP-23 calls this the
      // "un-determinable" case.
      expect(pageContent).toContain('No potluck to show');
    });
  });

  describe('FPP-23: legacy /photos redirects', () => {
    const pagePath = path.join(process.cwd(), 'src/app/photos/page.tsx');

    it('uses permanentRedirect for a 301 to the relevant event', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      expect(pageContent).toContain('permanentRedirect');
    });

    it('redirects to the next upcoming published event with photos', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      expect(pageContent).toContain('/events/');
      expect(pageContent).toContain('/photos');
      expect(pageContent).toContain('photos: { some: { deletedAt: null } }');
    });

    it('renders a friendly message when no event can host the redirect', async () => {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      expect(pageContent).toContain('No photos to show');
    });
  });

  describe('FPP-21: potluck management moved to the RSVP form', () => {
    const sheetPath = path.join(process.cwd(), 'src/components/event/RsvpBottomSheet.tsx');
    const sectionPath = path.join(process.cwd(), 'src/components/potluck/PotluckSection.tsx');

    it('embeds the potluck section inside the RSVP form', async () => {
      const sheetContent = await fs.readFile(sheetPath, 'utf-8');
      expect(sheetContent).toContain('PotluckSection');
    });

    it('exposes a deep-link flag to focus the potluck section', async () => {
      const sheetContent = await fs.readFile(sheetPath, 'utf-8');
      expect(sheetContent).toContain('initialPotluckFocus');
    });

    it('provides a PotluckSection component for the form', async () => {
      const stat = await fs.stat(sectionPath);
      expect(stat.isFile()).toBe(true);
      const sectionContent = await fs.readFile(sectionPath, 'utf-8');
      expect(sectionContent).toContain('trpc.potluck.listSlots.useQuery');
      expect(sectionContent).toContain('trpc.potluck.signup.useMutation');
      expect(sectionContent).toContain('trpc.potluck.cancelSignup.useMutation');
    });
  });

  describe('navigation: top-level potluck and photos links removed', () => {
    const navPath = path.join(process.cwd(), 'src/components/NavBarClient.tsx');

    it('does not advertise /potluck or /photos at the top level', async () => {
      const navContent = await fs.readFile(navPath, 'utf-8');
      expect(navContent).not.toMatch(/href=("|')\/potluck("|')/);
      expect(navContent).not.toMatch(/href=("|')\/photos("|')/);
    });
  });
});
