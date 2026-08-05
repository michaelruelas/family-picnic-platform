import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Per-member RSVP attendance (FPP-30, FPP-29)', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const rsvpRouterPath = path.join(process.cwd(), 'src/server/routers/rsvp.router.ts');
  const rsvpApiRoutePath = path.join(process.cwd(), 'src/app/api/rsvp/route.ts');
  const rsvpMemberAttendanceSchemaPath = path.join(
    process.cwd(),
    'src/lib/schemas/rsvp-member-attendance.ts',
  );
  const schemasIndexPath = path.join(process.cwd(), 'src/lib/schemas/index.ts');
  const rsvpBottomSheetPath = path.join(process.cwd(), 'src/components/event/RsvpBottomSheet.tsx');
  const eventRsvpCardPath = path.join(process.cwd(), 'src/components/event/EventRsvpCard.tsx');
  const confirmationPagePath = path.join(
    process.cwd(),
    'src/app/my-events/[rsvpId]/confirmation/page.tsx',
  );
  const adminMembersPagePath = path.join(
    process.cwd(),
    'src/app/admin/events/[id]/members/page.tsx',
  );
  const rsvpSchemaPath = path.join(process.cwd(), 'src/lib/schemas/rsvp.ts');
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20260804120000_rsvp_member_attendance/migration.sql',
  );
  const homePagePath = path.join(process.cwd(), 'src/app/page.tsx');
  const onboardingHouseholdRoutePath = path.join(
    process.cwd(),
    'src/app/api/onboarding/household/route.ts',
  );

  describe('Schema', () => {
    it('declares RsvpAttending enum with YES, NO, MAYBE', async () => {
      const content = await fs.readFile(schemaPath, 'utf-8');
      expect(content).toMatch(/enum RsvpAttending \{[\s\S]*?YES[\s\S]*?NO[\s\S]*?MAYBE/);
    });

    it('declares RsvpMemberAttendance model with snapshot fields and indexes', async () => {
      const content = await fs.readFile(schemaPath, 'utf-8');
      expect(content).toContain('model RsvpMemberAttendance');
      expect(content).toContain('memberNameSnapshot');
      expect(content).toContain('memberAgeSnapshot');
      expect(content).toContain('attending');
      expect(content).toMatch(/@@unique\(\[rsvpId, householdMemberId\]\)/);
    });

    it('wires RsvpMemberAttendance to RSVP and HouseholdMember', async () => {
      const content = await fs.readFile(schemaPath, 'utf-8');
      expect(content).toMatch(/model RSVP \{[\s\S]*?memberAttendances\s+RsvpMemberAttendance\[\]/);
      expect(content).toMatch(
        /model HouseholdMember \{[\s\S]*?rsvpAttendances\s+RsvpMemberAttendance\[\]/,
      );
    });
  });

  describe('Migration backfill', () => {
    it('creates the RsvpAttending enum and the new table', async () => {
      const sql = await fs.readFile(migrationPath, 'utf-8');
      expect(sql).toContain('CREATE TYPE "RsvpAttending"');
      expect(sql).toContain('CREATE TABLE "RsvpMemberAttendance"');
    });

    it('backfills per-member attendance rows from existing RSVPs', async () => {
      const sql = await fs.readFile(migrationPath, 'utf-8');
      expect(sql).toMatch(/INSERT INTO "RsvpMemberAttendance"/);
      // Backfill must use headcount to decide YES vs NO.
      expect(sql).toMatch(/hm\.rownum <= r\."headcount"/);
    });
  });

  describe('Schemas', () => {
    it('exports the new module from the schema index', async () => {
      const content = await fs.readFile(schemasIndexPath, 'utf-8');
      expect(content).toContain('./rsvp-member-attendance');
    });

    it('rejects empty member attendance lists', async () => {
      const content = await fs.readFile(rsvpMemberAttendanceSchemaPath, 'utf-8');
      expect(content).toContain('rsvpMemberAttendanceListSchema');
      expect(content).toMatch(/min\(1, 'Mark attendance for at least one member'\)/);
    });

    it('attendingLabel renders human-friendly text', async () => {
      const content = await fs.readFile(rsvpMemberAttendanceSchemaPath, 'utf-8');
      expect(content).toContain('attendingLabel');
      expect(content).toContain('case RsvpAttending.YES');
    });

    it('rsvpConfirmSchema accepts memberAttendances', async () => {
      const content = await fs.readFile(rsvpSchemaPath, 'utf-8');
      expect(content).toContain('memberAttendances: rsvpMemberAttendanceListSchema.optional()');
    });
  });

  describe('tRPC router', () => {
    it('confirm accepts and persists memberAttendances', async () => {
      const content = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(content).toContain('rsvpConfirmSchema');
      expect(content).toContain('resolveAndPersistAttendances');
      expect(content).toContain('attendanceFingerprint');
    });

    it('decline marks existing attendances NO', async () => {
      const content = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(content).toMatch(/markAllAttendanceNo/);
      const serviceContent = await fs.readFile(
        path.join(process.cwd(), 'src/server/rsvp-attendance.ts'),
        'utf-8',
      );
      expect(serviceContent).toContain('RsvpAttending.NO');
    });

    it('getMyRsvp returns member attendances', async () => {
      const content = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(content).toMatch(/getMyRsvp[\s\S]*?memberAttendances:/);
    });

    it('getByEvent returns per-RSVP member attendances', async () => {
      const content = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(content).toMatch(/getByEvent[\s\S]*?memberAttendances:/);
    });

    it('exposes getRsvpFormState for the RSVP form', async () => {
      const content = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(content).toContain('getRsvpFormState');
      expect(content).toMatch(/getRsvpFormState[\s\S]*?include:[\s\S]*?memberAttendances/);
    });
  });

  describe('REST /api/rsvp', () => {
    it('accepts memberAttendances in the confirm payload', async () => {
      const content = await fs.readFile(rsvpApiRoutePath, 'utf-8');
      expect(content).toContain(
        'memberAttendances: z.array(rsvpMemberAttendanceInputSchema).optional()',
      );
    });

    it('persists member attendance rows on confirm', async () => {
      const content = await fs.readFile(rsvpApiRoutePath, 'utf-8');
      expect(content).toContain('resolveAndPersistAttendances');
    });
  });

  describe('UI - RsvpBottomSheet', () => {
    it('lists household members with per-member attendance dropdowns', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toContain('ATTENDANCE_OPTIONS');
      expect(content).toMatch(/<select[\s\S]*?value=\{draft\.attending\}/);
      expect(content).toContain('attendingLabel(opt)');
    });

    it('submits memberAttendances to the confirm mutation', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      // FPP-36 renames draft.memberName through `trimmedDrafts`
      // before the confirm mutation runs, but the per-row shape
      // (householdMemberId, memberName, memberAge, attending) is
      // unchanged. Match either the legacy or the new mapping.
      expect(content).toMatch(/memberAttendances:\s*(trimmedDrafts|drafts)\.map/);
    });

    it('stays on the sheet and shows the success banner after a successful confirm (FPP-21)', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).not.toContain('/my-events/${result.id}/confirmation');
      expect(content).toContain('rsvp-success-banner');
      expect(content).toContain("setActiveTab('dishes')");
    });
  });

  describe('UI - EventRsvpCard', () => {
    it('shows the per-member attendance list on a confirmed RSVP', async () => {
      const content = await fs.readFile(eventRsvpCardPath, 'utf-8');
      expect(content).toContain('memberAttendances.map');
      expect(content).toContain('attendingLabel(att.attending)');
    });

    it('links to the confirmation page', async () => {
      const content = await fs.readFile(eventRsvpCardPath, 'utf-8');
      expect(content).toContain('View confirmation');
      expect(content).toContain('/my-events/${existingRsvp.id}/confirmation');
    });
  });

  describe('Confirmation page', () => {
    it('groups attendance rows by status', async () => {
      const content = await fs.readFile(confirmationPagePath, 'utf-8');
      expect(content).toContain('yesAttendances');
      expect(content).toContain('maybeAttendances');
      expect(content).toContain('noAttendances');
    });

    it('shows potluck claims, fee total block, and edit link', async () => {
      const content = await fs.readFile(confirmationPagePath, 'utf-8');
      expect(content).toContain('Potluck');
      expect(content).toContain('Payment total');
      // FPP-77: the fee block now reads Registration.amountCents and
      // Event.currency. The placeholder copy was replaced by the
      // FeeTotalBlock component, which renders nothing when the
      // registration is free.
      expect(content).toContain('FeeTotalBlock');
      expect(content).toMatch(/registration\.amountCents|registration\?\.amountCents/);
      expect(content).toMatch(/registration\.currency|registration\?\.currency|event\.currency/);
      expect(content).not.toContain('Stripe checkout ships (QUB-28.2)');
      expect(content).toContain('Edit RSVP');
      expect(content).toContain('Back to My Events');
    });

    it('returns 404 for an RSVP that does not belong to the caller', async () => {
      const content = await fs.readFile(confirmationPagePath, 'utf-8');
      expect(content).toContain('notFound');
      expect(content).toMatch(/rsvp\.user\.id !== session\.user\.id/);
    });
  });

  describe('Admin members view', () => {
    it('shows per-member attendance per household', async () => {
      const content = await fs.readFile(adminMembersPagePath, 'utf-8');
      expect(content).toContain('memberAttendances');
      expect(content).toContain('attendingLabel(att.attending)');
      expect(content).toMatch(/Going[\s\S]*?Maybe[\s\S]*?Not going/);
    });
  });

  describe('Home page deep link (QUB-17)', () => {
    it('queries the user\u2019s next RSVP for the CTA', async () => {
      const content = await fs.readFile(homePagePath, 'utf-8');
      expect(content).toContain('nextUserRsvp');
      expect(content).toContain('confirmation');
      expect(content).toMatch(/View your RSVP/);
    });
  });

  describe('Onboarding seeds the household', () => {
    it('creates a self member when the household is created', async () => {
      const content = await fs.readFile(onboardingHouseholdRoutePath, 'utf-8');
      expect(content).toContain('tx.householdMember.create');
      expect(content).toMatch(/\$transaction/);
    });
  });
});
