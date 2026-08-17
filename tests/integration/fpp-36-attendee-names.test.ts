import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-36: per-slot attendee name on the RSVP form.
 *
 * These tests are deliberately structural: they assert the
 * contracts that downstream code relies on (form has editable name
 * inputs, shared schema enforces the rules, the backfill migration
 * exists) without spinning up a database. The unit tests in
 * `src/lib/schemas/__tests__/schemas.test.ts` cover the schema
 * behavior; the integration tests cover the wiring.
 */
describe('FPP-36: per-slot attendee names', () => {
  const attendeeNameSchemaPath = path.join(process.cwd(), 'src/lib/schemas/attendee-name.ts');
  const rsvpMemberAttendanceSchemaPath = path.join(
    process.cwd(),
    'src/lib/schemas/rsvp-member-attendance.ts',
  );
  const householdMemberSchemaPath = path.join(process.cwd(), 'src/lib/schemas/household-member.ts');
  const rsvpAttendanceServicePath = path.join(process.cwd(), 'src/server/rsvp-attendance.ts');
  const rsvpBottomSheetPath = path.join(process.cwd(), 'src/components/event/RsvpBottomSheet.tsx');
  const useHouseholdHookPath = path.join(process.cwd(), 'src/hooks/useHousehold.ts');
  const hooksIndexPath = path.join(process.cwd(), 'src/hooks/index.ts');
  const schemaIndexPath = path.join(process.cwd(), 'src/lib/schemas/index.ts');
  const memberPatchRoutePath = path.join(
    process.cwd(),
    'src/app/api/household-members/[id]/route.ts',
  );
  const backfillMigrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20260807090000_fpp36_attendee_name_backfill/migration.sql',
  );

  describe('Shared attendee-name schema', () => {
    it('lives in its own module', async () => {
      const content = await fs.readFile(attendeeNameSchemaPath, 'utf-8');
      expect(content).toMatch(/export const attendeeNameSchema/);
      expect(content).toMatch(/ATTENDEE_NAME_MAX\s*=\s*120/);
    });

    it('rejects ASCII control characters and Unicode line separators', async () => {
      const content = await fs.readFile(attendeeNameSchemaPath, 'utf-8');
      // eslint-disable-next-line no-control-regex -- the test asserts the regex denies these characters.
      expect(content).toMatch(/[\x00-\x1f\x7f]/);
      // The file uses escape sequences inside the regex literal so
      // the source stays ASCII-safe; assert those escapes appear.
      expect(content).toContain('\u005cu2028');
      expect(content).toContain('\u005cu2029');
      expect(content).toContain('\u005cu202f');
    });

    it('is exported from the schemas barrel', async () => {
      const content = await fs.readFile(schemaIndexPath, 'utf-8');
      expect(content).toContain('./attendee-name');
    });

    it('is reused by the RSVP attendance input schema', async () => {
      const content = await fs.readFile(rsvpMemberAttendanceSchemaPath, 'utf-8');
      expect(content).toMatch(/memberName:\s*attendeeNameSchema/);
    });

    it('is reused by the household-member create / update schemas', async () => {
      const content = await fs.readFile(householdMemberSchemaPath, 'utf-8');
      expect(content).toMatch(/name:\s*attendeeNameSchema(\.optional)?/);
    });

    // FPP-36 review finding 1: the server-side clamp must use the
    // shared `ATTENDEE_NAME_MAX` constant, not a magic number.
    // Otherwise a future bump of the cap silently desyncs.
    it('server-side clamp uses ATTENDEE_NAME_MAX, not a magic number', async () => {
      const content = await fs.readFile(rsvpAttendanceServicePath, 'utf-8');
      expect(content).toMatch(/import.*ATTENDEE_NAME_MAX.*from.*attendee-name/);
      expect(content).toMatch(/\.slice\(0,\s*ATTENDEE_NAME_MAX\)/);
      expect(content).not.toMatch(/\.slice\(0,\s*120\s*\)/);
    });
  });

  describe('Form: editable name per slot', () => {
    it('renders an input (not a static label) for each attendee slot', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      // The input is the editable affordance for FPP-36.
      expect(content).toMatch(/data-testid="rsvp-attendee-name"/);
      // The form must surface validation errors inline.
      expect(content).toMatch(/data-testid="rsvp-attendee-name-error"/);
    });

    // FPP-36 review finding 3: source the accessible name from the
    // validated snapshot when one exists, so a control-character
    // payload never leaks into the accessible name. Ad-hoc guests
    // (no snapshot) fall back to the trimmed live value, but only
    // after the schema accepts it — trim alone does not strip
    // control characters.
    it('aria-label is sourced from originalMemberName, not the raw live input', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      // The snapshot is the primary source.
      expect(content).toMatch(/draft\.originalMemberName\s*\?\?/);
      // The fallback for ad-hoc guests trims the live value, so the
      // accessible name matches what gets persisted.
      expect(content).toMatch(/draft\.memberName\.trim\(\)/);
      // The live fallback must pass through `attendeeNameSchema`
      // before it lands in the accessible name — trim() alone
      // strips whitespace but not control characters.
      expect(content).toMatch(/attendeeNameSchema\.safeParse\(/);
      // The final fallback (empty input) is a generic slot label.
      expect(content).toMatch(/`slot \$\{index \+ 1\}`/);
      expect(content).toMatch(/aria-label=\{`Name for \$\{accessibleName\}`\}/);
      expect(content).toMatch(/aria-label=\{`Attendance for \$\{accessibleName\}`\}/);
      // The accessible name is never derived from the untrimmed live input.
      expect(content).not.toMatch(/accessibleName\s*=\s*draft\.memberName\b/);
      // The final tier falls through to a generic slot label when
      // the live value fails schema validation (empty, control
      // characters, oversized). The schema check is the gate, not
      // just the empty-string check, so we assert the safeParse
      // path is wired in.
      expect(content).toMatch(/safeLiveName\s*\?\?\s*`slot/);
    });

    // FPP-36 review finding 4: trim trailing whitespace on blur so
    // the visible value matches what gets persisted.
    it('trims trailing whitespace on input blur', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toMatch(/onBlur=\{?\(?\) => trimMemberNameDraft\(index\)\}?/);
      expect(content).toMatch(/trimMemberNameDraft/);
      expect(content).toMatch(/\.replace\(/);
    });

    it('disables confirm when a slot name is invalid', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toMatch(/disabled=\{isSubmitting \|\| yesCount === 0 \|\| hasInvalidNames\}/);
    });

    it('persists renames to the underlying household member on confirm', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toContain('useHouseholdMemberNameMutation');
      expect(content).toContain('updateMemberName.mutateAsync');
      // The PATCH should be skipped when neither the name nor the
      // age has changed. FPP-107 tracks both baselines so an age-only
      // edit (head of household setting their age) still PATCHes.
      expect(content).toMatch(/const nameChanged = draft\.memberName !== draft\.originalMemberName;/);
      expect(content).toMatch(/const ageChanged = draft\.memberAge !== draft\.originalMemberAge;/);
      expect(content).toMatch(/if \(!nameChanged && !ageChanged\) continue;/);
    });

    // BoopPr finding F1: when a rename fails mid-loop, the error
    // message must surface which rows were already persisted.
    // The summary must include both the original and the new name
    // (in `from → to` form) so two renames that land on the same
    // value do not collapse into an ambiguous list.
    it('rename loop surfaces a partial-success summary in the error message', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      // The catch block prefixes the error with the summary. The
      // assertion targets the user-visible error text so the test
      // survives a refactor of the internal list/identifier.
      expect(content).toMatch(/summary\s*\?\s*`\$\{summary\}\$\{base\}`\s*:\s*base/);
      // The summary uses the `from → to` arrow so the original
      // name is always visible alongside the new one.
      expect(content).toMatch(/\$\{r\.from\}\s*→\s*\$\{r\.to\}/);
      // Pluralization handles the single-row case (`member`) and
      // the multi-row case (`members`).
      expect(content).toMatch(/\$\{renames\.length === 1 \? '' : 's'\}/);
    });

    it('blocks confirm when any slot name fails attendee-name validation', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toContain('attendeeNameSchema');
      expect(content).toMatch(/firstNameError\?\.message \?\? 'Each attendee needs a valid name.'/);
    });
  });

  describe('Hook + REST route wiring', () => {
    it('exposes useHouseholdMemberNameMutation', async () => {
      const content = await fs.readFile(useHouseholdHookPath, 'utf-8');
      expect(content).toMatch(/export function useHouseholdMemberNameMutation/);
      // Must PATCH the existing member route, not invent a new one.
      expect(content).toContain('`/api/household-members/${input.id}`');
    });

    it('is exported from the hooks barrel', async () => {
      const content = await fs.readFile(hooksIndexPath, 'utf-8');
      expect(content).toContain('useHouseholdMemberNameMutation');
    });

    it('routes through /api/household-members/[id] PATCH', async () => {
      const content = await fs.readFile(memberPatchRoutePath, 'utf-8');
      expect(content).toContain('householdMemberUpdateSchema');
      expect(content).toContain('prisma.householdMember.update');
    });
  });

  describe('Backfill migration', () => {
    it('exists and uses the Guest N placeholder shape', async () => {
      const sql = await fs.readFile(backfillMigrationPath, 'utf-8');
      expect(sql).toMatch(/INSERT INTO "RsvpMemberAttendance"/);
      expect(sql).toContain("'Guest '");
      expect(sql).toMatch(/"memberNameSnapshot"/);
      // Declined RSVPs get NO placeholders so a declined RSVP does
      // not show fake "going" guests on the confirmation page.
      expect(sql).toMatch(/WHEN .*'DECLINED'.*'NO'/);
    });

    it('is bounded by (headcount - existing rows) so re-running is a no-op', async () => {
      const sql = await fs.readFile(backfillMigrationPath, 'utf-8');
      expect(sql).toMatch(/generate_series\(1, GREATEST\(.*headcount.*-.*existing/);
    });

    it('does not use ON CONFLICT (NULL householdMemberId values never collide on the unique index)', async () => {
      const sql = await fs.readFile(backfillMigrationPath, 'utf-8');
      // Strip SQL comments so the test does not match the
      // explanatory text about why the clause is absent.
      const codeOnly = sql.replace(/--[^\n]*/g, '');
      expect(codeOnly).not.toMatch(/ON CONFLICT/);
    });
  });
});
