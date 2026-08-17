import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('FPP-112: Potluck details in RSVP confirmation view', () => {
  const confirmationPagePath = path.join(
    process.cwd(),
    'src/app/my-events/[rsvpId]/confirmation/page.tsx',
  );
  const potluckTablePath = path.join(process.cwd(), 'src/components/potluck/PotluckTable.tsx');

  it('confirmation page includes PotluckTable component', async () => {
    const content = await fs.readFile(confirmationPagePath, 'utf-8');
    expect(content).toContain('PotluckTable');
    expect(content).toContain('slots={rsvp.event.potluckSlots}');
  });

  it('queries all confirmed signups with user and household info', async () => {
    const content = await fs.readFile(confirmationPagePath, 'utf-8');
    expect(content).toContain("where: { rsvp: { status: 'CONFIRMED' } }");
    expect(content).toContain('household: { select: { name: true } }');
  });

  it('PotluckTable component renders table structure with signups and available slots', async () => {
    const content = await fs.readFile(potluckTablePath, 'utf-8');
    expect(content).toContain('PotluckTable');
    expect(content).toContain('data-testid="potluck-table"');
    expect(content).toContain('Signed up');
    expect(content).toContain('Not signed up');
    expect(content).toContain('Brought By');
  });
});
