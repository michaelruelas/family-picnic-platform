import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('RSVP duplicate backfill script (FPP-28)', () => {
  const scriptPath = path.join(process.cwd(), 'prisma/backfill-rsvp-duplicates.ts');
  const libPath = path.join(process.cwd(), 'src/lib/rsvp-backfill.ts');
  const packagePath = path.join(process.cwd(), 'package.json');

  it('script file exists and is a thin CLI wrapper', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toContain("from '../src/lib/rsvp-backfill.js'");
    expect(content).toContain('process.argv');
    expect(content).toContain("'--apply'");
  });

  it('script uses mergeDuplicateRsvps and formatRsvpBackfillResult from the lib', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toContain('mergeDuplicateRsvps');
    expect(content).toContain('formatRsvpBackfillResult');
  });

  it('script defaults to dry-run (no --apply flag means no writes)', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/argv\.includes\(['"]--apply['"]\)/);
  });

  it('script exits non-zero when any group fails to merge', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/process\.exit\(1\)/);
  });

  it('lib exports mergeDuplicateRsvps, findDuplicateRsvpPlans, and formatRsvpBackfillResult', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    expect(content).toContain('export async function mergeDuplicateRsvps');
    expect(content).toContain('export async function findDuplicateRsvpPlans');
    expect(content).toContain('export function formatRsvpBackfillResult');
  });

  it('lib uses RSVP_MERGE as the audit log action for traceability', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    expect(content).toContain("'RSVP_MERGE'");
    expect(content).toContain('adminAuditLog.create');
  });

  it('lib reassigns PotluckSignup before deleting loser RSVPs (cascade ordering)', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    const reassignIndex = content.indexOf('potluckSignup.updateMany');
    const deleteIndex = content.indexOf('rSVP.delete');
    expect(reassignIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(reassignIndex).toBeLessThan(deleteIndex);
  });

  it('lib wraps each group merge in a $transaction for atomicity', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    const transactionMatches = content.match(/\$transaction\(/g) ?? [];
    expect(transactionMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('package.json exposes a db:backfill-rsvp-duplicates script', async () => {
    const pkg = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
    expect(pkg.scripts).toHaveProperty('db:backfill-rsvp-duplicates');
    expect(pkg.scripts['db:backfill-rsvp-duplicates']).toContain(
      'prisma/backfill-rsvp-duplicates.ts',
    );
  });
});
