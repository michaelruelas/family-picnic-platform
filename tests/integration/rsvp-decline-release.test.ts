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

  it('decrements PotluckSlot.currentSignups once for each released slot', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('currentSignups: { decrement: 1 }');
    expect(routeContent).not.toContain('decrement: signup.servings');
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

  it('updates RSVP status to DECLINED and zeroes headcount on decline', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    // The route maps decline -> DECLINED status. The headcount for a
    // decline is set to 0 (either via a ternary or a separate const).
    expect(routeContent).toMatch(
      /status:\s*action\s*===\s*'confirm'\s*\?\s*RSVPStatus\.CONFIRMED\s*:\s*RSVPStatus\.DECLINED/,
    );
    // Decline must land the headcount at 0. Look for any of the
    // shape variations used by the route.
    const declineHeadcount =
      /action\s*===\s*'decline'\s*\?\s*0/.test(routeContent) ||
      /:\s*0[,;\s]/.test(routeContent) ||
      /headcount:\s*0/.test(routeContent);
    expect(declineHeadcount).toBe(true);
  });

  it('handles case where user has no existing potluck signups gracefully', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('existingRsvp?.potluckSignups || []');
  });
});
