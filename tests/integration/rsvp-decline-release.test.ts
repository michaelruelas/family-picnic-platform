import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('RSVP Decline Auto-Release Potluck Slots', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/rsvp/route.ts');

  it('uses $transaction for decline action to ensure atomicity', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('$transaction');
  });

  it('finds existing potluck signups before declining RSVP', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('potluckSignups');
    expect(routeContent).toContain('existingRsvp');
  });

  it('decrements PotluckSlot.currentSignups for each released slot', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('currentSignups: { decrement:');
    expect(routeContent).toContain('signup.servings');
  });

  it('deletes all potluck signups tied to the RSVP', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('potluckSignup.deleteMany');
    expect(routeContent).toContain('rsvpId: existingRsvp?.id');
  });

  it('creates audit log entry for slot release', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('adminAuditLog.create');
    expect(routeContent).toContain('POTLUCK_SLOT_RELEASE');
    expect(routeContent).toContain('oldValue');
    expect(routeContent).toContain('newValue');
  });

  it('updates RSVP status to DECLINED and headcount to 0', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('status: RSVPStatus.DECLINED');
    expect(routeContent).toContain('headcount: 0');
  });

  it('handles case where user has no existing potluck signups gracefully', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('existingRsvp?.potluckSignups || []');
  });
});
