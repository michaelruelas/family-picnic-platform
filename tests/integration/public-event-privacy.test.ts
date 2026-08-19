import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Auth-gated privacy for the public event page.
 *
 * Locks in the structural contract that anonymous viewers (no
 * session) never see household names, host names, host contact
 * info, or member first names — and that the gallery is replaced
 * with a sign-in prompt rather than rendered silently.
 *
 * Why structural: the page renders server-side via Prisma
 * include shapes + JSX conditionals. The behavioural contract is
 * "when isLoggedIn is false, these personal fields are absent
 * from the page". Asserting the gating lines in the source
 * catches the easiest regressions (someone removing the `? []`
 * ternary and re-introducing a leak) without booting a database.
 *
 * Component-level behaviour (Suspense fallback, prop defaults)
 * is covered by `src/components/event/__tests__/EventSectionTabs.test.tsx`
 * and `src/components/potluck/__tests__/SlotList.readOnly.test.tsx`.
 */
describe('Public event page privacy (anonymous viewer)', () => {
  const eventPagePath = path.join(process.cwd(), 'src/app/events/[id]/page.tsx');
  const potluckPagePath = path.join(process.cwd(), 'src/app/events/[id]/potluck/page.tsx');
  const photosPagePath = path.join(process.cwd(), 'src/app/events/[id]/photos/page.tsx');
  const slotListPath = path.join(process.cwd(), 'src/components/potluck/SlotList.tsx');
  const eventSectionTabsPath = path.join(
    process.cwd(),
    'src/components/event/EventSectionTabs.tsx',
  );

  describe('event overview page (/events/[id])', () => {
    it('gates the hosts list on the isLoggedIn flag', async () => {
      const content = await fs.readFile(eventPagePath, 'utf-8');
      // Hosts (name + email + phone) are personal data; the
      // page must hand EventSectionTabs an empty array when the
      // viewer is anonymous so HostBlock renders nothing.
      expect(content).toMatch(/hosts=\{isLoggedIn\s*\?\s*hosts\s*:\s*\[\]\}/);
    });

    it('passes isLoggedIn through to EventSectionTabs', async () => {
      const content = await fs.readFile(eventPagePath, 'utf-8');
      expect(content).toContain('isLoggedIn={isLoggedIn}');
    });

    it('does NOT short-circuit publicAttendees at the page level (the component decides)', async () => {
      // Defensive: page passes the full list and lets
      // EventSectionTabs swap in a SignInPrompt for anonymous
      // viewers. Asserting the negation here keeps the contract
      // honest if a future refactor moves the gate back to the
      // page (which would silently re-leak the data through
      // EventSectionTabs' prop default).
      const content = await fs.readFile(eventPagePath, 'utf-8');
      expect(content).toMatch(/publicAttendees=\{publicAttendeesRsvps\}/);
      expect(content).not.toMatch(/publicAttendees=\{isLoggedIn\s*\?\s*publicAttendeesRsvps/);
    });
  });

  describe('potluck page (/events/[id]/potluck)', () => {
    it('still passes full slot data to SlotList (the component gates the name suffix)', async () => {
      // The page pulls householdName + user.name for the readOnly
      // SlotList. We hide the suffix inside the component when
      // userId is null rather than truncating the data here so
      // the same component works for the in-sheet editable view.
      const content = await fs.readFile(potluckPagePath, 'utf-8');
      expect(content).toContain('slots={slots}');
    });
  });

  describe('SlotList component', () => {
    it('omits the household + user name suffix when userId is null', async () => {
      // Look for the conditional `!userId ? '' : s.rsvp.householdName ? ...`
      // chain that strips the identity handle from anonymous views.
      const content = await fs.readFile(slotListPath, 'utf-8');
      expect(content).toMatch(/!\s*userId\s*\?\s*['"`]['"`]\s*:/);
    });
  });

  describe('EventSectionTabs component', () => {
    it('exposes an isLoggedIn prop defaulting to false', async () => {
      // Defaulting to false (logged-out) keeps personal data
      // hidden for callers that haven't been updated yet.
      const content = await fs.readFile(eventSectionTabsPath, 'utf-8');
      expect(content).toMatch(/isLoggedIn\?:\s*boolean/);
      expect(content).toMatch(/isLoggedIn\s*=\s*false/);
    });

    it('renders a SignInPrompt in place of PublicAttendeeList for anonymous viewers', async () => {
      const content = await fs.readFile(eventSectionTabsPath, 'utf-8');
      expect(content).toMatch(/isLoggedIn\s*\?\s*\(\s*<PublicAttendeeList/);
      expect(content).toContain('<SignInPrompt');
    });
  });

  describe('photos page (/events/[id]/photos)', () => {
    it('replaces the photo gallery with a SignInPrompt for anonymous viewers', async () => {
      const content = await fs.readFile(photosPagePath, 'utf-8');
      // Anonymous users must see the prompt, not the gallery.
      expect(content).toMatch(/!\s*userId\s*\?\s*\(/);
      expect(content).toContain('<SignInPrompt');
      // The UploadButton is already gated on userId; assert that
      // path is unchanged so we don't accidentally let anonymous
      // viewers upload photos through this route.
      expect(content).toMatch(/\{userId\s*&&\s*\(/);
    });
  });
});
