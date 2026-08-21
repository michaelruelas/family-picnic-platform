import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Universal Event RSVP and Vanity Invitation URL', () => {
  const legacyPagePath = path.join(process.cwd(), 'src/app/events/invitation/[token]/page.tsx');
  const vanityRsvpPath = path.join(process.cwd(), 'src/app/events/[id]/rsvp/page.tsx');
  const cardPath = path.join(process.cwd(), 'src/components/event/EventRsvpCard.tsx');
  const headerPath = path.join(process.cwd(), 'src/components/event/EventHeaderSection.tsx');
  const eventPagePath = path.join(process.cwd(), 'src/app/events/[id]/page.tsx');
  const eventsListPagePath = path.join(process.cwd(), 'src/app/events/page.tsx');
  const homePagePath = path.join(process.cwd(), 'src/app/page.tsx');

  it('vanity RSVP route exists and redirects to event with rsvpOpen=1', async () => {
    const vanityPage = await fs.readFile(vanityRsvpPath, 'utf-8');
    expect(vanityPage).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(vanityPage).toMatch(/prisma\.event\.findUnique/);
    expect(vanityPage).toMatch(/redirect\(`\/events\/\$\{id\}\?rsvpOpen=1`\)/);
  });

  it('legacy invitation route redirects to event vanity RSVP URL', async () => {
    const legacyPage = await fs.readFile(legacyPagePath, 'utf-8');
    expect(legacyPage).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(legacyPage).toMatch(/redirect\(`\/events\/\$\{invitation\.eventId\}\/rsvp`\)/);
  });

  it('event page and RSVP card allow universal direct RSVP without pending invitation gate', async () => {
    const card = await fs.readFile(cardPath, 'utf-8');
    const header = await fs.readFile(headerPath, 'utf-8');
    const eventPage = await fs.readFile(eventPagePath, 'utf-8');

    // No hasPendingInvitation gate
    expect(card).not.toMatch(/hasPendingInvitation/);
    expect(header).not.toMatch(/hasPendingInvitation/);
    expect(eventPage).not.toMatch(/hasPendingInvitation/);

    // Direct RSVP affordances
    expect(card).toMatch(/data-testid="rsvp-card-rsvp-button"/);
    expect(card).toMatch(/RSVP Now/);
    expect(card).toMatch(/Join Waitlist/);
  });

  it('home page redirects to latest event when configured (single-hop, no double redirect)', async () => {
    const homePage = await fs.readFile(homePagePath, 'utf-8');
    expect(homePage).toMatch(/shouldRedirectToLatestEvent/);
    expect(homePage).toMatch(/getLatestEvent/);
    expect(homePage).toMatch(/redirect\(`\/events\/\$\{latestEvent\.id\}`\)/);

    const eventsPage = await fs.readFile(eventsListPagePath, 'utf-8');
    expect(eventsPage).not.toMatch(/shouldRedirectToLatestEvent/);
    expect(eventsPage).not.toMatch(/getLatestEvent/);
  });
});
