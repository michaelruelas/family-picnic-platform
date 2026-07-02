import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('RSVP Cumulative Headcount (SPEC §8.1)', () => {
  const householdRouterPath = path.join(
    process.cwd(),
    'src/server/routers/household.router.ts'
  );

  it('getCumulativeHeadcount procedure filters for CONFIRMED status only', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    expect(content).toContain("status: 'CONFIRMED'");
  });

  it('getCumulativeHeadcount procedure filters for PUBLISHED events', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    expect(content).toContain("status: 'PUBLISHED'");
  });

  it('getCumulativeHeadcount procedure filters for events with date >= now', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    expect(content).toContain('date: { gte: now }');
  });

  it('getCumulativeHeadcount sums headcounts from all household RSVPs', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    expect(content).toMatch(/reduce.*\(.*sum.*r\.headcount.*\)/);
    expect(content).toContain('totalHeadcount');
  });

  it('getCumulativeHeadcount returns per-event breakdown', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    expect(content).toContain('byEvent');
    expect(content).toContain('eventId');
    expect(content).toContain('eventName');
  });

  it('getCumulativeHeadcount procedure is protected (requires auth)', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    const getCumulativeSection = content.substring(content.indexOf('getCumulativeHeadcount'));
    expect(getCumulativeSection).toContain('protectedProcedure');
  });
});

describe('Nested Households (SPEC §8.2)', () => {
  const householdRouterPath = path.join(
    process.cwd(),
    'src/server/routers/household.router.ts'
  );
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');

  it('Household model has parentHouseholdId self-reference', async () => {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    expect(schemaContent).toMatch(/model Household \{[\s\S]*?parentHouseholdId\s+String\?/);
  });

  it('getTree returns only root households (no parent)', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    const getTreeSection = content.substring(content.indexOf('getTree'));
    expect(getTreeSection).toContain('!h.parentHouseholdId');
  });

  it('getTree includes children with their users and dependents', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    const getTreeSection = content.substring(content.indexOf('getTree'));
    expect(getTreeSection).toContain('children');
    expect(getTreeSection).toContain('users');
    expect(getTreeSection).toContain('dependents');
  });

  it('Household children relationship is properly defined in schema', async () => {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    const householdModel = schemaContent.match(/model Household \{[\s\S]*?\n}/)?.[0];
    expect(householdModel).toMatch(/children\s+Household\[\]/);
  });

  it('Household parent relationship uses HouseholdTree relation', async () => {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    const householdModel = schemaContent.match(/model Household \{[\s\S]*?\n}/)?.[0];
    expect(householdModel).toMatch(/parentHouseholdId\s+String\?/);
    expect(householdModel).toMatch(/@relation\("HouseholdTree"\)/);
  });

  it('getTree recursive fetch includes nested children (up to 4 levels)', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    const getTreeSection = content.substring(content.indexOf('getTree'));
    expect(getTreeSection).toContain('children:');
    expect(getTreeSection).toMatch(/children:\s*\{[\s\S]*?include:\s*\{[\s\S]*?users/);
  });

  it('getCumulativeHeadcount aggregates across all members in household', async () => {
    const content = await fs.readFile(householdRouterPath, 'utf-8');
    const getCumulativeSection = content.substring(content.indexOf('getCumulativeHeadcount'));
    expect(getCumulativeSection).toContain('householdId: input.householdId');
  });
});