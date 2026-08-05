import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const potluckPagePath = path.join(process.cwd(), 'src/app/events/[id]/potluck/page.tsx');
const slotListPath = path.join(process.cwd(), 'src/components/potluck/SlotList.tsx');
const mySlotsPath = path.join(process.cwd(), 'src/components/potluck/MySlotsSummary.tsx');
const eventDetailPath = path.join(process.cwd(), 'src/app/events/[id]/page.tsx');
const rsvpCardPath = path.join(process.cwd(), 'src/components/event/EventRsvpCard.tsx');
const rsvpSheetPath = path.join(process.cwd(), 'src/components/event/RsvpBottomSheet.tsx');
const potluckRouterPath = path.join(process.cwd(), 'src/server/routers/potluck.router.ts');
const usePotluckHookPath = path.join(process.cwd(), 'src/hooks/usePotluck.ts');

describe('FPP-27 — Slot list view grouped by category', () => {
  it('has a route at /events/[id]/potluck', async () => {
    const content = await fs.readFile(potluckPagePath, 'utf-8');
    expect(content).toContain('export const dynamic');
    expect(content).toContain('SlotList');
  });

  it('groups slots by category in display order Mains → Sides → Desserts → Drinks → Other', async () => {
    const content = await fs.readFile(slotListPath, 'utf-8');
    expect(content).toContain('DISPLAY_CATEGORY_ORDER');
    expect(content).toMatch(/MAIN[\s\S]*SIDE[\s\S]*DESSERT[\s\S]*DRINK[\s\S]*OTHER/);
  });

  it('shows the slot name, category, and remaining capacity', async () => {
    const content = await fs.readFile(slotListPath, 'utf-8');
    expect(content).toContain('POTLUCK_CATEGORY_LABELS');
    expect(content).toContain('remainingCapacity');
    expect(content).toContain('slot.name');
    expect(content).toContain('currentSignups');
  });

  it('renders an empty-state when no slots are configured', async () => {
    const content = await fs.readFile(slotListPath, 'utf-8');
    expect(content).toContain('The menu is still being planned');
  });
});

describe('FPP-26 — Multi-slot select', () => {
  it('renders a Claim button on every unclaimed slot', async () => {
    const content = await fs.readFile(slotListPath, 'utf-8');
    expect(content).toContain('Claim this dish');
  });

  it('marks claimed slots with a Yours badge', async () => {
    const content = await fs.readFile(slotListPath, 'utf-8');
    expect(content).toContain('Yours');
    expect(content).toContain('data-testid="yours-badge"');
  });

  it('prompts for a dish name and submits via the signup mutation', async () => {
    const content = await fs.readFile(slotListPath, 'utf-8');
    expect(content).toContain('dishName');
    expect(content).toContain('signup.mutateAsync');
    expect(content).toContain('What are you bringing?');
  });

  it('allows multiple signups — the slot list does not pre-filter claimed slots', async () => {
    const content = await fs.readFile(slotListPath, 'utf-8');
    // No code path hides a category once the user has claimed one slot.
    expect(content).not.toMatch(/if\s*\(isMine\)\s*return\s+null/);
  });
});

describe('FPP-25 — My-slots summary + remove', () => {
  it('renders a My Slots panel that is always visible', async () => {
    const content = await fs.readFile(mySlotsPath, 'utf-8');
    expect(content).toContain('My slots');
    expect(content).toContain('data-testid="my-slots-summary"');
  });

  it('lets the user drop a slot from the summary', async () => {
    const content = await fs.readFile(mySlotsPath, 'utf-8');
    expect(content).toContain('cancelSignup.mutateAsync');
    expect(content).toContain('data-testid="my-slot-drop"');
  });

  it('always renders the summary on the potluck page (FPP-25.4 reachability from RSVP form)', async () => {
    const pageContent = await fs.readFile(potluckPagePath, 'utf-8');
    expect(pageContent).toContain('MySlotsSummary');
  });

  // FPP-51 removed the standalone potluck index page and the
  // RSVP card's "Manage potluck dishes" deep link. Replacements
  // for these reachability checks land in slot 04 (FPP-21),
  // which introduces the Dishes tab inside the RSVP bottom
  // sheet and the Edit attendance & dishes CTA on the RSVP
  // card. Slot 01 only ships the page deletion and the 301
  // route, so we keep the remaining tests focused on the slot
  // it actually changes.

  it('reaches the potluck page from the event detail menu section', async () => {
    const content = await fs.readFile(eventDetailPath, 'utf-8');
    expect(content).toContain('/potluck');
    expect(content).toContain('Manage your dishes');
    expect(content).toContain('Browse the potluck menu');
  });
});

describe('FPP-26/25 — Backed by the potluck router + hook', () => {
  it('exposes a getMySignups query for the caller-only list', async () => {
    const content = await fs.readFile(potluckRouterPath, 'utf-8');
    expect(content).toContain('getMySignups');
    expect(content).toContain('orderBy: { claimedAt:');
  });

  it('invalidates getMySignups when signups change', async () => {
    const content = await fs.readFile(usePotluckHookPath, 'utf-8');
    expect(content).toContain('getMySignups.invalidate');
  });
});
