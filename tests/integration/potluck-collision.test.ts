import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Potluck Slot Race Condition Fix', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/potluck-signup/route.ts');

  it('uses $transaction with Serializable isolation for LIMITED slot signups', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('$transaction');
    expect(routeContent).toContain('isolationLevel');
    expect(routeContent).toContain('Serializable');
  });

  it('checks currentSignups count inside transaction before creating signup', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain('potluckSignup.count');
    expect(routeContent).toContain('currentSignups');
  });

  it('throws error when slot is full inside transaction', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain("throw new Error('Slot is full')");
  });

  it('handles Slot is full error with 409 Conflict response', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    expect(routeContent).toContain("error.message === 'Slot is full'");
    expect(routeContent).toContain('status: 409');
  });

  it('increments currentSignups atomically inside transaction for new signups', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    const hasAtomicIncrement = routeContent.includes('currentSignups: { increment: 1 }');
    expect(hasAtomicIncrement).toBe(true);
  });

  it('does not use manual count-then-increment pattern outside transaction', async () => {
    const routeContent = await fs.readFile(routePath, 'utf-8');
    const lines = routeContent.split('\n');
    let insideLimitedSlotTransaction = false;
    let foundNonTransactionalPattern = false;

    for (const line of lines) {
      if (
        line.includes("slot.slotType === 'LIMITED'") ||
        line.includes('slot.slotType === "LIMITED"')
      ) {
        insideLimitedSlotTransaction = true;
      }
      if (insideLimitedSlotTransaction && line.includes('$transaction')) {
        insideLimitedSlotTransaction = false;
      }
      if (
        insideLimitedSlotTransaction &&
        !line.includes('$transaction') &&
        line.includes('currentSignups: { increment: 1 }')
      ) {
        foundNonTransactionalPattern = true;
      }
    }

    expect(foundNonTransactionalPattern).toBe(false);
  });
});
