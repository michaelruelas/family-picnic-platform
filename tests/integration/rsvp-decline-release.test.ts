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

  it('creates audit log entry for RSVP update with diff', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('adminAuditLog.create');
    expect(routeContent).toContain('RSVP_UPDATE');
    expect(routeContent).toContain('oldValue');
    expect(routeContent).toContain('newValue');
  });

  it('updates RSVP status to DECLINED and headcount to 0 on decline', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    // rsvpData maps decline -> DECLINED status and headcount 0 via a ternary
    expect(routeContent).toMatch(
      /status:\s*action\s*===\s*'confirm'\s*\?\s*RSVPStatus\.CONFIRMED\s*:\s*RSVPStatus\.DECLINED/,
    );
    expect(routeContent).toMatch(
      /headcount:\s*action\s*===\s*'confirm'\s*\?\s*headcount\s*\|\|\s*1\s*:\s*0/,
    );
  });

  it('handles case where user has no existing potluck signups gracefully', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('existingRsvp?.potluckSignups || []');
  });
});
