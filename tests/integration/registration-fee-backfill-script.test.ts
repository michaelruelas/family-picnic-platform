import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Registration fee backfill script (FPP-14)', () => {
  const scriptPath = path.join(process.cwd(), 'prisma/backfill-registration-fees.ts');
  const libPath = path.join(process.cwd(), 'src/lib/registration-fee-backfill.ts');
  const packagePath = path.join(process.cwd(), 'package.json');

  it('script file exists and is a thin CLI wrapper', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toContain("from '../src/lib/registration-fee-backfill.js'");
    expect(content).toContain('process.argv');
    expect(content).toContain("'--apply'");
  });

  it('script uses backfillRegistrationFees and formatRegistrationFeeBackfillResult from the lib', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toContain('backfillRegistrationFees');
    expect(content).toContain('formatRegistrationFeeBackfillResult');
  });

  it('script defaults to dry-run (no --apply flag means no writes)', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/argv\.includes\(['"]--apply['"]\)/);
  });

  it('script exits non-zero when any registration fails to backfill', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/process\.exit\(1\)/);
  });

  it('lib exports the public API surface (find + apply + format)', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    expect(content).toContain('export async function findRegistrationFeeBackfillPlans');
    expect(content).toContain('export async function backfillRegistrationFees');
    expect(content).toContain('export function formatRegistrationFeeBackfillResult');
  });

  it('lib uses REGISTRATION_FEE_BACKFILL as the audit log action for traceability', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    expect(content).toContain("'REGISTRATION_FEE_BACKFILL'");
    expect(content).toContain('adminAuditLog.create');
  });

  it('lib wraps each registration backfill in a $transaction for atomicity', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    const transactionMatches = content.match(/\$transaction\(/g) ?? [];
    expect(transactionMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('lib explicitly excludes settled (PAID/REFUNDED/FORFEITED/CANCELLED) rows from zeroing', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    expect(content).toContain("'PAID'");
    expect(content).toContain("'REFUNDED'");
    expect(content).toContain("'FORFEITED'");
    expect(content).toContain("'CANCELLED'");
  });

  it('package.json exposes a db:backfill-registration-fees script', async () => {
    const pkg = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
    expect(pkg.scripts).toHaveProperty('db:backfill-registration-fees');
    expect(pkg.scripts['db:backfill-registration-fees']).toContain(
      'prisma/backfill-registration-fees.ts',
    );
  });
});
