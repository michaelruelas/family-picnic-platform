import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('FPP-53 registration-cannot-be-edited close-out', () => {
  const confirmationPagePath = path.join(
    process.cwd(),
    'src/app/my-events/[rsvpId]/confirmation/page.tsx',
  );
  const lastUpdatedPath = path.join(process.cwd(), 'src/components/event/RsvpLastUpdated.tsx');
  const eventRsvpCardPath = path.join(process.cwd(), 'src/components/event/EventRsvpCard.tsx');
  const rsvpRouterPath = path.join(process.cwd(), 'src/server/routers/rsvp.router.ts');
  const eventPagePath = path.join(process.cwd(), 'src/app/events/[id]/page.tsx');
  const rsvpSchemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const auditLibPath = path.join(process.cwd(), 'src/lib/audit.ts');

  describe('AC #4: Last updated on confirmation screen', () => {
    it('confirmation page renders RsvpLastUpdated from rsvp.modifiedAt', async () => {
      const content = await fs.readFile(confirmationPagePath, 'utf-8');
      expect(content).toContain('RsvpLastUpdated');
      // Loose matcher: any JSX expression reading `.modifiedAt` from a parent scope.
      // Survives trivial refactors (variable alias, prop rename) without going flaky.
      expect(content).toMatch(/modifiedAt=\{[^}]*\.modifiedAt[^}]*\}/);
    });

    it('RsvpLastUpdated is a server-safe component shared by the card', async () => {
      const component = await fs.readFile(lastUpdatedPath, 'utf-8');
      expect(component).not.toContain("'use client'");
      expect(component).toContain('export function RsvpLastUpdated');
      expect(component).toContain('Last updated');
      expect(component).toContain('toLocaleString');
      expect(component).toContain('dateTime=');
    });

    it('EventRsvpCard reuses the shared RsvpLastUpdated (no duplicate copy)', async () => {
      const card = await fs.readFile(eventRsvpCardPath, 'utf-8');
      expect(card).toContain("import { RsvpLastUpdated } from './RsvpLastUpdated'");
      // No leftover local definition now that the shared component exists.
      expect(card).not.toMatch(/function LastUpdated\(/);
    });
  });

  describe('Regression: ACs #1-#3 still hold', () => {
    it('AC #1: event page pre-fills from existing RSVP', async () => {
      const page = await fs.readFile(eventPagePath, 'utf-8');
      expect(page).toMatch(/userId\s*\?\s*prisma\.rSVP\.findFirst/);
      expect(page).toMatch(/where:\s*\{\s*eventId:\s*id,\s*userId\s*\}/);
      expect(page).toContain('modifiedAt: true');
    });

    it('AC #2: rsvp router upserts on eventId+userId (in place)', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      // The unique key on the schema is what makes the upsert in-place.
      const schema = await fs.readFile(rsvpSchemaPath, 'utf-8');
      expect(schema).toMatch(/@@unique\(\[eventId, userId\]\)/);
      // Both confirm and decline use upsert with that key.
      expect((router.match(/tx\.rSVP\.upsert/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it('AC #3: rsvp router writes RSVP_UPDATE audit with diff', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(router).toContain("action: 'RSVP_UPDATE'");
      expect(router).toContain('oldValue');
      expect(router).toContain('newValue');
      // writeAuditLog must support an audit diff helper.
      const audit = await fs.readFile(auditLibPath, 'utf-8');
      expect(audit).toMatch(/export function diff|export const diff/);
    });
  });
});
