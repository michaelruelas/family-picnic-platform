import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const potluckPagePath = path.join(process.cwd(), 'src/app/events/[id]/potluck/page.tsx');
const slotListPath = path.join(process.cwd(), 'src/components/potluck/SlotList.tsx');
const mySlotsPath = path.join(process.cwd(), 'src/components/potluck/MySlotsSummary.tsx');
const rsvpCardPath = path.join(process.cwd(), 'src/components/event/EventRsvpCard.tsx');
const rsvpSheetPath = path.join(process.cwd(), 'src/components/event/RsvpBottomSheet.tsx');
const potluckRouterPath = path.join(process.cwd(), 'src/server/routers/potluck.router.ts');
const usePotluckHookPath = path.join(process.cwd(), 'src/hooks/usePotluck.ts');
const potluckEditorPath = path.join(process.cwd(), 'src/components/event/PotluckEditor.tsx');
const eventNavPath = path.join(process.cwd(), 'src/components/event/EventNav.tsx');

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
    // FPP-54: the slot name is rendered via the shared `slotDisplayName`
    // helper. The component still surfaces the name (or a category-based
    // placeholder when the slot has none).
    expect(content).toMatch(/slotDisplayName\(/);
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
});

describe('FPP-21 — Potluck editing moved into the RSVP bottom sheet (Dishes tab)', () => {
  it('replaces the standalone Manage potluck link with Edit attendance & dishes on the RSVP card', async () => {
    const cardContent = await fs.readFile(rsvpCardPath, 'utf-8');
    expect(cardContent).not.toContain('Manage potluck dishes');
    expect(cardContent).toContain('Edit attendance');
    expect(cardContent).toContain('dishes');
  });

  it('renders Attendance and Dishes tabs in the RSVP bottom sheet', async () => {
    const sheetContent = await fs.readFile(rsvpSheetPath, 'utf-8');
    expect(sheetContent).toContain('Attendance');
    expect(sheetContent).toContain('Dishes');
    expect(sheetContent).toContain('rsvp-tab-attendance');
    expect(sheetContent).toContain('rsvp-tab-dishes');
  });

  it('embeds PotluckEditor in the Dishes tab when the RSVP is confirmed', async () => {
    const sheetContent = await fs.readFile(rsvpSheetPath, 'utf-8');
    expect(sheetContent).toContain('PotluckEditor');
    expect(sheetContent).toContain("status === 'CONFIRMED'");
  });

  it('shows an RSVP-first hint in the Dishes tab when the RSVP is not confirmed', async () => {
    const sheetContent = await fs.readFile(rsvpSheetPath, 'utf-8');
    expect(sheetContent).toContain('RSVP first');
  });

  it('supports the ?rsvpOpen=1#dishes deep link to open the sheet on the Dishes tab', async () => {
    const sheetContent = await fs.readFile(rsvpSheetPath, 'utf-8');
    expect(sheetContent).toContain('rsvpOpen');
    expect(sheetContent).toContain('#dishes');
  });

  it('renders the standalone potluck page as read-only with a deep link to the editor', async () => {
    const pageContent = await fs.readFile(potluckPagePath, 'utf-8');
    expect(pageContent).toContain('readOnly');
    expect(pageContent).toContain('Edit my dishes');
    expect(pageContent).toContain('rsvpOpen=1');
  });

  it('mounts PotluckEditor with the event id', async () => {
    const editorContent = await fs.readFile(potluckEditorPath, 'utf-8');
    expect(editorContent).toContain('PotluckEditor');
    expect(editorContent).toContain('SlotList');
    expect(editorContent).toContain('MySlotsSummary');
  });

  it('reaches the potluck page from the event detail subnav (FPP-139)', async () => {
    // FPP-139: potluck carousel preview was removed from EventHeaderSection;
    // guests jump to the standalone potluck page via the route-level EventNav.
    const navContent = await fs.readFile(eventNavPath, 'utf-8');
    expect(navContent).toContain('/potluck');
    expect(navContent).toContain('Potluck');
  });
});

describe('FPP-26/25 — Backed by the potluck router + hook', () => {
  it('exposes a getMySignups query for the caller-only list', async () => {
    const content = await fs.readFile(potluckRouterPath, 'utf-8');
    expect(content).toContain('getMySignups');
    expect(content).toContain('orderBy: { claimedAt:');
  });

  it('exposes a getSlotsForEvent query used by the Dishes tab', async () => {
    const content = await fs.readFile(potluckRouterPath, 'utf-8');
    expect(content).toContain('getSlotsForEvent');
  });

  it('invalidates getMySignups when signups change', async () => {
    const content = await fs.readFile(usePotluckHookPath, 'utf-8');
    expect(content).toContain('getMySignups.invalidate');
  });
});
