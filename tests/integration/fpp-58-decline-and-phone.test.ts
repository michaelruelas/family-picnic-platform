import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-58 umbrella: decline path + phone capture for the RSVP form.
 *
 * These tests are deliberately structural: they assert the
 * contracts that downstream code relies on (form has a decline
 * link for users with no RSVP, the confirmation page stops the
 * potluck flow on DECLINED, the phone + consent UI is wired to
 * `user.updatePreferences` and the server-side consent gating is
 * preserved) without spinning up a database. The unit tests in
 * `tests/lib/schemas.test.ts` cover the schema behaviour.
 */
describe('FPP-58: RSVP names + decline path + phone capture', () => {
  const rsvpCardPath = path.join(process.cwd(), 'src/components/event/EventRsvpCard.tsx');
  const rsvpStickyBarPath = path.join(process.cwd(), 'src/components/event/EventStickyBar.tsx');
  const rsvpConfirmationPath = path.join(
    process.cwd(),
    'src/app/my-events/[rsvpId]/confirmation/page.tsx',
  );
  const rsvpBottomSheetPath = path.join(process.cwd(), 'src/components/event/RsvpBottomSheet.tsx');
  const rsvpContactSchemaPath = path.join(process.cwd(), 'src/lib/schemas/rsvp-contact.ts');
  const schemasIndexPath = path.join(process.cwd(), 'src/lib/schemas/index.ts');
  const rsvpRouterPath = path.join(process.cwd(), 'src/server/routers/rsvp.router.ts');
  const userRouterPath = path.join(process.cwd(), 'src/server/routers/user.router.ts');
  const trpcCtxPath = path.join(process.cwd(), 'src/lib/trpc.ts');
  const smsDispatchPath = path.join(process.cwd(), 'src/lib/sms-dispatch.ts');

  describe('FPP-35: explicit decline path for users with no RSVP', () => {
    it('renders a "Can\'t make it" button on the empty-state card', async () => {
      const content = await fs.readFile(rsvpCardPath, 'utf-8');
      // The button must live in the no-RSVP branch (the bottom of
      // the file), not just on the CONFIRMED branch.
      const noRsvpBranch = content.split('return (\n    <>\n      <div')[1] ?? '';
      expect(noRsvpBranch).toMatch(/Can.?t make it/);
      // Test id lets the e2e and integration suites target the
      // button without scraping copy.
      expect(noRsvpBranch).toMatch(/data-testid="rsvp-card-decline-link"/);
      // The decline link must trigger the same `decline.mutateAsync`
      // call the confirmed-state card uses, so a first-time decline
      // flows through the same router handler.
      expect(noRsvpBranch).toMatch(/handleDecline/);
    });

    it('hides the decline link when RSVP is closed (no past-deadline surprises)', async () => {
      const content = await fs.readFile(rsvpCardPath, 'utf-8');
      const noRsvpBranch = content.split('return (\n    <>\n      <div')[1] ?? '';
      // The button is gated on `isRsvpOpen` so a closed event does
      // not let a user write a DECLINED row past the deadline.
      expect(noRsvpBranch).toMatch(/isRsvpOpen\s*&&\s*\(\s*<button\s+onClick=\{handleDecline\}/);
    });

    it('also surfaces the decline path on the mobile sticky bar', async () => {
      const content = await fs.readFile(rsvpStickyBarPath, 'utf-8');
      expect(content).toMatch(/Can.?t make it/);
      // Test id is also exposed on the sticky bar so the mobile
      // flow can be exercised from tests.
      expect(content).toMatch(/data-testid="rsvp-sticky-decline-link"/);
      // The sticky bar wires its own decline handler that calls
      // the same `decline.mutateAsync({ eventId })` shape.
      expect(content).toMatch(/decline\.mutateAsync\(\s*\{\s*eventId\s*\}\s*\)/);
    });

    it('shows a "Declined" badge on the sticky bar when the existing RSVP is DECLINED', async () => {
      const content = await fs.readFile(rsvpStickyBarPath, 'utf-8');
      // The sticky bar mirrors the card's status badge. The card
      // already shows the DECLINED badge; the sticky bar must too.
      expect(content).toMatch(/isDeclined/);
      expect(content).toMatch(/Declined/);
    });

    it('skips the Potluck section and renders a thank-you view on the confirmation page when DECLINED', async () => {
      const content = await fs.readFile(rsvpConfirmationPath, 'utf-8');
      // The potluck section must be gated on status != DECLINED.
      expect(content).toMatch(/rsvp\.status\s*!==\s*RSVPStatus\.DECLINED\s*&&\s*\(/);
      // A dedicated "thanks for letting us know" block renders in
      // place of the potluck section so the user does not see an
      // empty "Nothing claimed yet" copy that reads as a bug.
      expect(content).toMatch(/Thanks for letting us know/);
      expect(content).toMatch(/rsvp\.status\s*===\s*RSVPStatus\.DECLINED/);
    });

    it('routes first-time decline through the existing decline procedure (no attendance list required)', async () => {
      // The RSVP router's decline handler already supports a
      // first-time decline by materializing the roster as NO. This
      // is the precondition for the inline button to work without
      // forcing the user through the attendance form.
      const content = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(content).toMatch(/buildRosterAsNo/);
      // And the decline procedure must not require memberAttendances.
      const declineDecl = content.match(/decline:\s*protectedProcedure\.input\([^)]+\)/);
      expect(declineDecl).not.toBeNull();
      expect(declineDecl?.[0]).toMatch(/rsvpDeclineSchema/);
    });
  });

  describe('FPP-34: optional phone + comms consent', () => {
    it('shares the contact schema via the schemas barrel', async () => {
      const index = await fs.readFile(schemasIndexPath, 'utf-8');
      expect(index).toContain('./rsvp-contact');
      const schema = await fs.readFile(rsvpContactSchemaPath, 'utf-8');
      expect(schema).toMatch(/export const rsvpContactSchema/);
      expect(schema).toMatch(/export function diffContact/);
    });

    it('reuses the shared E.164 schema so the rule stays in sync with profile + sms routes', async () => {
      const schema = await fs.readFile(rsvpContactSchemaPath, 'utf-8');
      expect(schema).toMatch(/import.*e164Schema.*from.*\.\/sms/);
      // The consent-required rule lives in a superRefine so the
      // validation message names the smsConsent field, not the
      // phone field.
      expect(schema).toMatch(/superRefine/);
      expect(schema).toMatch(/path:\s*\[\s*'smsConsent'\s*\]/);
    });

    it('emits a no-op patch when the user submits without touching the contact fields', async () => {
      const schema = await fs.readFile(rsvpContactSchemaPath, 'utf-8');
      expect(schema).toMatch(/export function diffContact/);
      // The diff helper returns an empty object when phone + consent
      // are both unchanged, so a no-touch submit is a single
      // round-trip to the rsvp router, not two.
      expect(schema).toMatch(/return \{\};/);
    });

    it('clears a stale smsConsent=true when the user removes their phone', async () => {
      // Without this rule, a user who opts in to SMS, then later
      // clears the phone, would still have smsConsent=true on
      // file — and the sms-dispatch gate would happily re-enable
      // Twilio the moment they typed a new number.
      const schema = await fs.readFile(rsvpContactSchemaPath, 'utf-8');
      // The empty-phone branch must clear both fields.
      const emptyBranch = schema.split('if (trimmed.length === 0)')[1] ?? '';
      expect(emptyBranch).toMatch(/phoneNumber:\s*null/);
      expect(emptyBranch).toMatch(/smsConsent:\s*false/);
    });

    it('exposes phone + sms consent on the RSVP form-state snapshot', async () => {
      const content = await fs.readFile(rsvpRouterPath, 'utf-8');
      // The query selects the fields needed to hydrate the form.
      expect(content).toMatch(/phoneNumber:\s*true/);
      expect(content).toMatch(/smsConsent:\s*true/);
      // The procedure also returns the snapshot alongside the
      // household roster so the form has everything in one fetch.
      expect(content).toMatch(/phoneNumber:\s*caller\.phoneNumber\s*\?\?\s*null/);
      expect(content).toMatch(/smsConsent:\s*caller\.smsConsent/);
    });

    it('captures the client IP at SMS consent time (audit trail)', async () => {
      // The user router must stamp smsConsentIp so the consent can
      // be audited. The trpc context must forward headers so the
      // procedure can extract the IP.
      const trpc = await fs.readFile(trpcCtxPath, 'utf-8');
      expect(trpc).toMatch(/headers\?:\s*Headers/);
      const userRouter = await fs.readFile(userRouterPath, 'utf-8');
      expect(userRouter).toMatch(/smsConsentIp/);
      // The user router must reuse the allowlist-based extractClientIp
      // from the shared client-ip module rather than ship a less-secure
      // local duplicate. Local copies tend to skip the trusted-proxy
      // gate and would silently stamp a spoofed header from the client.
      expect(userRouter).toContain('~/lib/client-ip');
      expect(userRouter).toMatch(/parseTrustedProxyIps/);
      expect(userRouter).toMatch(/TRUSTED_PROXY_IPS/);
      // And the duplicate local definition must be gone.
      expect(userRouter).not.toMatch(/function\s+extractClientIp\s*\(/);
    });

    it('renders the phone input + consent checkbox on the RSVP form', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toMatch(/data-testid="rsvp-phone-input"/);
      expect(content).toMatch(/data-testid="rsvp-sms-consent"/);
      expect(content).toMatch(/data-testid="rsvp-sms-consent-error"/);
      // Collapsed by default — the user has to opt in by clicking
      // the toggle so the phone field is not in the user's face.
      expect(content).toMatch(/!showContact\s*\?\s*\(/);
    });

    it('hydrates the contact section from the form-state snapshot', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toMatch(/setPhone\(formState\.phoneNumber\s*\?\?\s*''\)/);
      expect(content).toMatch(/setSmsConsent\(Boolean\(formState\.smsConsent\)\)/);
      // Open the section automatically when a phone is already on
      // file, so a returning user does not have to click again.
      expect(content).toMatch(/setShowContact\(Boolean\(formState\.phoneNumber\)\)/);
    });

    it('shares the contact validate + diff + PATCH helper across confirm and decline', async () => {
      // RD-001: the validate → diff → PATCH block used to be duplicated
      // between handleConfirm and handleDecline. A future tweak to
      // the consent-required rule would have to land in both, and
      // would almost certainly miss one. The fix is a single helper
      // that both handlers call.
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toMatch(/const\s+persistContactIfChanged\s*=\s*async/);
      // The helper must do the schema validation, the diff, and the
      // PATCH in one place. handleConfirm and handleDecline call
      // it instead of inlining the steps.
      expect(content).toMatch(/rsvpContactSchema\.safeParse\(/);
      expect(content).toMatch(/diffContact\(/);
      // The helper should be called from both submit handlers.
      const confirmBlock = content.split(/const\s+handleConfirm\s*=\s*async/)[1] ?? '';
      const declineBlock = content.split(/const\s+handleDecline\s*=\s*async/)[1] ?? '';
      expect(confirmBlock).toMatch(/persistContactIfChanged\(\)/);
      expect(declineBlock).toMatch(/persistContactIfChanged\(\)/);
      // And the decline path must NOT inline the validate → diff →
      // PATCH block (which is what we are trying to dedupe).
      expect(declineBlock).not.toMatch(/rsvpContactSchema\.safeParse\(/);
      expect(declineBlock).not.toMatch(/diffContact\(/);
    });

    it('validates the contact block before mutating anything', async () => {
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      // The schema is consulted inside persistContactIfChanged so
      // a phone without consent, or a non-E.164 phone, surfaces a
      // friendly error before we hit the server. The helper is
      // called from both submit handlers, so a bad phone is caught
      // on the decline path too.
      const helperBlock = content.split(/const\s+persistContactIfChanged\s*=\s*async/)[1] ?? '';
      expect(helperBlock).toMatch(/rsvpContactSchema\.safeParse\(\{[\s\S]*?phone,\s*smsConsent/);
      const confirmBlock = content.split(/const\s+handleConfirm\s*=\s*async/)[1] ?? '';
      const declineBlock = content.split(/const\s+handleDecline\s*=\s*async/)[1] ?? '';
      expect(confirmBlock).toMatch(/persistContactIfChanged\(\)/);
      expect(declineBlock).toMatch(/persistContactIfChanged\(\)/);
    });

    it('writes the patch through user.updatePreferences, not the rsvp router', async () => {
      // The phone is a profile-level field; it should not live on
      // the RSVP table. The bottom sheet routes the patch through
      // the user mutation that already exists.
      const content = await fs.readFile(rsvpBottomSheetPath, 'utf-8');
      expect(content).toMatch(/useUserProfileMutation/);
      expect(content).toMatch(/updatePreferences\.mutateAsync\(contactPatch\)/);
      // The rsvp router's confirm/decline input must not grow a
      // phone field — the contact flow is fully profile-side.
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(router).not.toMatch(/phoneNumber:\s*z\.string/);
    });
  });

  describe('Twilio gating is unchanged', () => {
    it('does not bypass the sms-dispatch consent gate', async () => {
      // Sanity check: FPP-34 lets a user opt in via the form, but
      // the actual send still has to clear the sms-dispatch gate.
      // If a future refactor adds a code path that sends without
      // dispatching through this gate, the structural test fires.
      const dispatch = await fs.readFile(smsDispatchPath, 'utf-8');
      expect(dispatch).toMatch(/recipient\.smsConsent/);
      expect(dispatch).toMatch(/NO_CONSENT/);
    });
  });
});
