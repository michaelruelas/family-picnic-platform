import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('FPP-102: manual RSVP entry in admin MembersTable', () => {
  const modalPath = path.join(process.cwd(), 'src/components/admin/AdminRsvpModal.tsx');
  const tablePath = path.join(process.cwd(), 'src/components/admin/MembersTable.tsx');
  const pagePath = path.join(process.cwd(), 'src/app/admin/events/[id]/members/page.tsx');
  const restPath = path.join(process.cwd(), 'src/app/api/admin/rsvp/override/route.ts');
  const routerPath = path.join(process.cwd(), 'src/server/routers/rsvp.router.ts');
  const schemaPath = path.join(process.cwd(), 'src/lib/schemas/rsvp.ts');

  describe('1. tRPC adminOverride proc exposes manual entry surface', () => {
    it('declares declineMessage on the adminOverride schema so the modal can ship a note', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const block = schema.match(/export const rsvpAdminOverrideSchema[\s\S]*?\}\);/);
      expect(block).not.toBeNull();
      expect(block![0]!).toMatch(/declineMessage:/);
      expect(block![0]!).toMatch(/z\.string\(\)\.trim\(\)/);
      expect(block![0]!).toMatch(/\.max\(1000/);
    });

    it('adminOverride persists declineMessage only on decline (clears on re-confirm)', async () => {
      const router = await fs.readFile(routerPath, 'utf-8');
      // FPP-104: the proc is now `eventAdminProcedure` (not
      // `auditedAdminProcedure`); the split regex mirrors the
      // new shape. The declineMessage persistence is unchanged
      // from the FPP-102 contract.
      const block = router.split(/adminOverride:\s*eventAdminProcedure/)[1] ?? '';
      // Both the create and update branches must stamp
      // `declineMessage: null` when the new status is not
      // DECLINED so a re-confirm wipes a stale note.
      expect(block).toMatch(
        /declineMessage:\s*input\.status\s*===\s*RSVPStatus\.DECLINED\s*\?\s*declineMessage\s*:\s*null/,
      );
    });

    it('adminOverride writes a DECLINE_NOTE CommunicationLog row to each event owner', async () => {
      const router = await fs.readFile(routerPath, 'utf-8');
      // FPP-104: the proc is now `eventAdminProcedure` (not
      // `auditedAdminProcedure`). The decline-note forward block
      // is identical to the prior implementation; the gate just
      // moved.
      const block = router.split(/adminOverride:\s*eventAdminProcedure/)[1] ?? '';
      // The forward block must be gated on a non-empty
      // declineMessage so a no-note decline does not write
      // empty log rows.
      expect(block).toMatch(
        /if\s*\(\s*input\.status\s*===\s*RSVPStatus\.DECLINED\s*&&\s*declineMessage\s*\)/,
      );
      expect(block).toMatch(/eventAdmin\.findMany/);
      expect(block).toMatch(/AdminPermission\.OWNER/);
      expect(block).toMatch(/kind:\s*CommunicationLogKind\.DECLINE_NOTE/);
    });

    it('adminOverride flips pre-existing attendances to NO on decline without a list', async () => {
      const router = await fs.readFile(routerPath, 'utf-8');
      const block = router.split(/adminOverride:\s*eventAdminProcedure/)[1] ?? '';
      // The modal hides the per-member grid on DECLINED, so the
      // server must defensively flip any YES/MAYBE rows to NO
      // so the decline is internally consistent.
      expect(block).toMatch(/markAllAttendanceNo/);
    });

    it('getById tRPC query is eventAdminProcedure and returns members + attendances', async () => {
      // FPP-104: getById is now `eventAdminProcedure` so a HOST
      // with an EventAdmin row for the parent event can fetch the
      // modal's prefilled form state. The builder takes the input
      // schema + a getEventId resolver before the `.query(...)`
      // call, so we look for the new shape directly.
      const router = await fs.readFile(routerPath, 'utf-8');
      expect(router).toMatch(/getById:\s*eventAdminProcedure/);
      // The getEventId resolver looks the RSVP up to find its
      // parent event so the gate has the id to consult.
      expect(router).toMatch(/getById:[\s\S]*?prisma\.rSVP\.findUnique[\s\S]*?eventId:\s*true/);
      // The query body must still return the full RSVP + members
      // (the procedure-level gate does not change the body).
      expect(router).toMatch(/getById:[\s\S]*?memberAttendances:/);
      expect(router).toMatch(/getById:[\s\S]*?householdMember\.findMany/);
      // Defensive: the old auditedAdminProcedure form must not
      // still be wired up.
      expect(router).not.toMatch(/getById:\s*auditedAdminProcedure/);
    });

    it('getByEvent tRPC query is eventAdminProcedure', async () => {
      // FPP-104: the admin MembersTable view of an event's
      // RSVPs is now per-event-gated. The proc is unchanged
      // otherwise.
      const router = await fs.readFile(routerPath, 'utf-8');
      expect(router).toMatch(/getByEvent:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/getByEvent:\s*auditedAdminProcedure/);
    });
  });

  describe('2. REST /api/admin/rsvp/override route mirrors the tRPC proc', () => {
    it('gates on per-event auth and validates with rsvpAdminOverrideSchema', async () => {
      const route = await fs.readFile(restPath, 'utf-8');
      // FPP-104: the route now uses `requireEventAdminApi` so a
      // HOST with an EventAdmin row for the event can override
      // RSVPs. The gate runs on the parsed eventId from the body.
      expect(route).toMatch(/requireEventAdminApi/);
      expect(route).not.toMatch(/requireAdminApi\(\)/);
      expect(route).toMatch(/rsvpAdminOverrideSchema\.safeParse/);
    });

    it('rejects when the target user is missing (404)', async () => {
      const route = await fs.readFile(restPath, 'utf-8');
      expect(route).toMatch(/if\s*\(!targetUser\)\s*\{[\s\S]*?404/);
    });

    it('runs the registration-fee sync via syncRegistrationFee', async () => {
      const route = await fs.readFile(restPath, 'utf-8');
      expect(route).toMatch(/syncRegistrationFee/);
      expect(route).toMatch(/registrationFeeCents/);
    });

    it('writes a diff-aware AuditLog row + AdminAuditLog path row', async () => {
      const route = await fs.readFile(restPath, 'utf-8');
      expect(route).toMatch(/writeDomainAuditLog/);
      expect(route).toMatch(/action:\s*'rsvp\.adminOverride'/);
      expect(route).toMatch(/writeAuditLog/);
    });

    it('forwards a non-empty decline note as DECLINE_NOTE to each event owner', async () => {
      const route = await fs.readFile(restPath, 'utf-8');
      expect(route).toMatch(/eventAdmin\.findMany/);
      expect(route).toMatch(/AdminPermission\.OWNER/);
      expect(route).toMatch(/kind:\s*CommunicationLogKind\.DECLINE_NOTE/);
      expect(route).toMatch(/body:\s*declineMessage/);
    });
  });

  describe('3. AdminRsvpModal wires both edit and add paths', () => {
    it('renders the modal and exposes status / headcount / decline / attendance controls', async () => {
      const modal = await fs.readFile(modalPath, 'utf-8');
      // Status radio group with CONFIRMED and DECLINED.
      expect(modal).toMatch(/status-\$\{value\.toLowerCase\(\)\}/);
      // Headcount input + auto-derivation.
      expect(modal).toMatch(/headcount-input/);
      expect(modal).toMatch(/yesCount/);
      // Decline message textarea.
      expect(modal).toMatch(/decline-message/);
      // Per-member attendance grid.
      expect(modal).toMatch(/attendance-grid/);
    });

    it('saves by POSTing to /api/admin/rsvp/override and refreshes the page', async () => {
      const modal = await fs.readFile(modalPath, 'utf-8');
      expect(modal).toMatch(/fetch\(['"]\/api\/admin\/rsvp\/override['"]/);
      expect(modal).toMatch(/router\.refresh\(\)/);
      expect(modal).toMatch(/addToast\(\s*['"]success['"]/);
    });

    it('hides the per-member grid + headcount on DECLINED and marks the event read-only on CANCELLED', async () => {
      const modal = await fs.readFile(modalPath, 'utf-8');
      // The grid is gated on CONFIRMED.
      expect(modal).toMatch(/status\s*===\s*RSVPStatus\.CONFIRMED\s*\?[\s\S]*?attendance-grid/);
      // Read-only banner on CANCELLED.
      expect(modal).toMatch(/isReadOnly/);
      expect(modal).toMatch(/admin-rsvp-readonly/);
    });
  });

  describe('4. MembersTable + members page expose the modal', () => {
    it('MembersTable renders an "Add RSVP" button + household picker', async () => {
      const table = await fs.readFile(tablePath, 'utf-8');
      expect(table).toMatch(/add-rsvp-button/);
      expect(table).toMatch(/add-rsvp-picker/);
    });

    it('MembersTable wires row clicks to the edit modal (disabled while CANCELLED)', async () => {
      const table = await fs.readFile(tablePath, 'utf-8');
      expect(table).toMatch(/onRowClick=\{isReadOnly\s*\?\s*undefined\s*:\s*openEdit\}/);
    });

    it('the members page passes the household roster to the modal and excludes households that already RSVPed', async () => {
      const page = await fs.readFile(pagePath, 'utf-8');
      expect(page).toMatch(/rsvps:\s*\{\s*none:\s*\{\s*eventId:\s*id\s*\}\s*\}/);
      expect(page).toMatch(/availableHouseholds/);
      expect(page).toMatch(/householdMember\.findMany/);
    });
  });
});
