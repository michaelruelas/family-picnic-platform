import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('FPP-88: server foundation (declineMessage, validate/commit, invitation URL)', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const rsvpSchemaPath = path.join(process.cwd(), 'src/lib/schemas/rsvp.ts');
  const rsvpRouterPath = path.join(process.cwd(), 'src/server/routers/rsvp.router.ts');
  const rsvpRestPath = path.join(process.cwd(), 'src/app/api/rsvp/route.ts');
  const invitationRouterPath = path.join(process.cwd(), 'src/server/routers/invitation.router.ts');
  const invitationRestPath = path.join(
    process.cwd(),
    'src/app/api/admin/invitations/send/route.ts',
  );
  const invitationTokenPath = path.join(process.cwd(), 'src/lib/invitation-token.ts');

  describe('1. RSVP.declineMessage column', () => {
    it('declares a nullable Text column on the RSVP model', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const block = schema.match(/model RSVP \{([\s\S]*?)^\}/m);
      expect(block).not.toBeNull();
      expect(block![1]!).toMatch(/declineMessage\s+String\?/);
    });

    it('adds the column in the FPP-88 migration', async () => {
      const migrationPath = path.join(
        process.cwd(),
        'prisma/migrations/20260806090000_fpp88_decline_message_and_body/migration.sql',
      );
      const sql = await fs.readFile(migrationPath, 'utf-8');
      expect(sql).toMatch(/ALTER TABLE "RSVP"\s+ADD COLUMN "declineMessage" TEXT/i);
    });
  });

  describe('2. rsvp.decline accepts declineMessage', () => {
    it('schema exposes an optional declineMessage with a 1000-char cap', async () => {
      const schema = await fs.readFile(rsvpSchemaPath, 'utf-8');
      const block = schema.match(/export const rsvpDeclineSchema[\s\S]*?\}\)/);
      expect(block).not.toBeNull();
      expect(block![0]!).toMatch(/declineMessage:/);
      expect(block![0]!).toMatch(/z\.string\(\)/);
      expect(block![0]!).toMatch(/\.trim\(\)/);
      expect(block![0]!).toMatch(/\.max\(1000/);
      expect(block![0]!).toMatch(/\.optional\(\)/);
    });

    it('tRPC decline handler persists declineMessage to the RSVP row', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      const declineBlock = router.split(/decline:\s*protectedProcedure\.input/)[1] ?? '';
      // Both the create and update branches of the upsert must
      // include declineMessage so a first-time decline with a
      // note and a decline-with-existing-RSVP-with-note both
      // land the text in the DB.
      const createSlice = declineBlock.split(/create: \{/)[1] ?? '';
      const createEnd = createSlice.indexOf('},');
      const createFields = createEnd >= 0 ? createSlice.slice(0, createEnd) : createSlice;
      const updateSlice = declineBlock.split(/update: \{/)[1] ?? '';
      const updateEnd = updateSlice.indexOf('},');
      const updateFields = updateEnd >= 0 ? updateSlice.slice(0, updateEnd) : updateSlice;
      expect(createFields).toMatch(/declineMessage/);
      expect(updateFields).toMatch(/declineMessage/);
    });

    it('tRPC decline handler trims the message and treats empty string as null', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      const declineBlock = router.split(/decline:\s*protectedProcedure\.input/)[1] ?? '';
      expect(declineBlock).toMatch(/input\.declineMessage\?\.trim\(\)\s*\|\|\s*null/);
    });

    it('tRPC decline handler writes a CommunicationLog row to each event owner when a note is supplied', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      const declineBlock = router.split(/decline:\s*protectedProcedure\.input/)[1] ?? '';
      // The writer must be gated on a non-empty note so we don't
      // create empty rows for every decline.
      expect(declineBlock).toMatch(/if\s*\(\s*declineMessage\s*\)/);
      // Must look up the event owners via EventAdmin.role.
      expect(declineBlock).toMatch(/eventAdmin\.findMany/);
      expect(declineBlock).toMatch(/AdminPermission\.OWNER/);
      // Must write the note text into the new body column.
      expect(declineBlock).toMatch(/communicationLog\.createMany/);
      expect(declineBlock).toMatch(/body:\s*declineMessage/);
    });

    it('tRPC decline handler skips the CommunicationLog write when the note is empty', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      const declineBlock = router.split(/decline:\s*protectedProcedure\.input/)[1] ?? '';
      // The forward-to-owner block is gated on a truthy message
      // so a bare decline (the existing UX) does not write a
      // stray log row.
      expect(declineBlock).toMatch(
        /if\s*\(\s*declineMessage\s*\)\s*\{[\s\S]*?eventAdmin\.findMany/,
      );
    });

    it('REST mirror /api/rsvp also accepts declineMessage', async () => {
      const rest = await fs.readFile(rsvpRestPath, 'utf-8');
      const declineDecl = rest.match(/action === 'decline'[\s\S]*?safeParse\(/);
      expect(declineDecl).not.toBeNull();
      expect(declineDecl![0]!).toMatch(/declineMessage/);
      expect(declineDecl![0]!).toMatch(/z\.string\(\)/);
      expect(declineDecl![0]!).toMatch(/\.trim\(\)/);
      expect(declineDecl![0]!).toMatch(/\.max\(1000/);
    });

    it('REST decline persists declineMessage and writes the CommunicationLog', async () => {
      const rest = await fs.readFile(rsvpRestPath, 'utf-8');
      // The trim + null-when-empty normalization happens before
      // the transaction so the same rule covers both paths.
      expect(rest).toMatch(/trimmedDeclineMessage/);
      expect(rest).toMatch(/declineNote/);
      // The block building `rsvpData` must include declineMessage.
      const rsvpDataDecl = rest.match(/const rsvpData = \{[\s\S]*?\};/);
      expect(rsvpDataDecl).not.toBeNull();
      expect(rsvpDataDecl![0]!).toMatch(
        /declineMessage:\s*action === 'decline' \? declineNote : null/,
      );
      // Anchor the slice at the decline wrapper (the second
      // `if (action === 'decline') {` in the file, the one that
      // wraps the actual $transaction) and look for the
      // forward-to-owner block inside.
      const declineActionBlock =
        rest.split(/if \(action === 'decline'\) \{\s*await prisma\.\$transaction/)[1] ?? '';
      expect(declineActionBlock).toMatch(/if \(declineNote\)/);
      expect(declineActionBlock).toMatch(/eventAdmin\.findMany/);
      expect(declineActionBlock).toMatch(/AdminPermission\.OWNER/);
      expect(declineActionBlock).toMatch(/body:\s*declineNote/);
    });

    it('FPP-88 review: REST decline gates waitlist promotion on prior CONFIRMED status', async () => {
      const rest = await fs.readFile(rsvpRestPath, 'utf-8');
      const declineActionBlock =
        rest.split(/if \(action === 'decline'\) \{\s*await prisma\.\$transaction/)[1] ?? '';
      // The promotion block must be inside `if (wasConfirmed) { ... }`
      // so a WAITLISTED decliner does not bump a waitlisted row to
      // CONFIRMED and inflate the headcount. Mirrors the tRPC gate.
      expect(declineActionBlock).toMatch(
        /const wasConfirmed\s*=\s*existingRsvp\?\.status\s*===\s*RSVPStatus\.CONFIRMED/,
      );
      expect(declineActionBlock).toMatch(
        /const hadWaitlistPosition\s*=\s*existingRsvp\?\.waitlistPosition/,
      );
      expect(declineActionBlock).toMatch(/if\s*\(\s*wasConfirmed\s*\)\s*\{[\s\S]*?firstWaitlisted/);
      // The else branch must renumber the rest of the waitlist
      // when the decliner was waitlisted, matching tRPC.
      expect(declineActionBlock).toMatch(/else if \(hadWaitlistPosition\)/);
      expect(declineActionBlock).toMatch(/waitlistPosition:\s*\{\s*decrement:\s*1\s*\}/);
      // The `firstWaitlisted` findFirst must live inside the
      // wasConfirmed branch, not at the top level.
      const wasConfirmedIndex = declineActionBlock.indexOf('if (wasConfirmed)');
      const firstWaitlistedIndex = declineActionBlock.indexOf('firstWaitlisted');
      expect(wasConfirmedIndex).toBeGreaterThan(-1);
      expect(firstWaitlistedIndex).toBeGreaterThan(wasConfirmedIndex);
    });
  });

  describe('3. invitation.consume split into validate + commit', () => {
    it('exposes both validate (query) and consume (mutation)', async () => {
      const router = await fs.readFile(invitationRouterPath, 'utf-8');
      expect(router).toMatch(/validate:\s*auditedAdminProcedure/);
      expect(router).toMatch(/consume:\s*auditedAdminProcedure/);
      // The validate procedure is followed by a `.query` call,
      // not `.mutation`, so the landing page cannot burn the
      // token by pre-flighting the invitation. Bound the slice
      // to the validate body only (everything before the next
      // procedure definition `consume:`).
      const validateSlice = router.split(/validate:\s*auditedAdminProcedure/)[1] ?? '';
      const validateEnd = validateSlice.indexOf('consume:');
      const validateBlock = validateEnd >= 0 ? validateSlice.slice(0, validateEnd) : validateSlice;
      expect(validateBlock).toMatch(/\.query\(/);
      expect(validateBlock).not.toMatch(/\.mutation\(/);
      const consumeSlice = router.split(/consume:\s*auditedAdminProcedure/)[1] ?? '';
      expect(consumeSlice).toMatch(/\.mutation\(/);
    });

    it('validate performs all the same pre-flight checks as consume', async () => {
      const router = await fs.readFile(invitationRouterPath, 'utf-8');
      const validateSlice = router.split(/validate:\s*auditedAdminProcedure/)[1] ?? '';
      const validateEnd = validateSlice.indexOf('consume:');
      const validateBlock = validateEnd >= 0 ? validateSlice.slice(0, validateEnd) : validateSlice;
      expect(validateBlock).toMatch(/Invitation not found/);
      expect(validateBlock).toMatch(/already been used/);
      expect(validateBlock).toMatch(/has expired/);
      // Reads the expiresAt and rejects past-due tokens.
      expect(validateBlock).toMatch(/expiresAt/);
      expect(validateBlock).toMatch(/new Date\(invitation\.expiresAt\)\s*<\s*new Date\(\)/);
    });

    it('validate does NOT persist status mutations (read-only)', async () => {
      const router = await fs.readFile(invitationRouterPath, 'utf-8');
      const validateSlice = router.split(/validate:\s*auditedAdminProcedure/)[1] ?? '';
      const validateEnd = validateSlice.indexOf('consume:');
      const validateBlock = validateEnd >= 0 ? validateSlice.slice(0, validateEnd) : validateSlice;
      // The read-only body must not call update() at all and
      // must not write EXPIRED (a transient clock skew should
      // not lock the user out).
      expect(validateBlock).not.toMatch(/prisma\.invitation\.update/);
      expect(validateBlock).not.toMatch(/status:\s*InvitationStatus\.EXPIRED/);
    });

    it('consume still marks the invitation USED on commit', async () => {
      const router = await fs.readFile(invitationRouterPath, 'utf-8');
      const consumeBlock = router.split(/consume:\s*auditedAdminProcedure/)[1] ?? '';
      expect(consumeBlock).toMatch(/status:\s*InvitationStatus\.USED/);
      // The mutation must include the joined event/household/user
      // so the wizard can render the confirmation page.
      expect(consumeBlock).toMatch(/include:[\s\S]*?event:\s*true/);
    });
  });

  describe('4. invitation.send builds the wizard URL', () => {
    it('FPP-88 review: REST /api/admin/invitations/send applies the same rate-limit gates as tRPC', async () => {
      const rest = await fs.readFile(invitationRestPath, 'utf-8');
      // The mirror must call all three rate-limit helpers and
      // bail out via the same TRPCError -> NextResponse mapping
      // the tRPC router uses. Without these, admins can flood
      // invitations by switching from tRPC to REST.
      expect(rest).toMatch(/checkAdminBroadcastRateLimit/);
      expect(rest).toMatch(/checkRecipientGroupRateLimit/);
      expect(rest).toMatch(/checkAllRecipientRateLimits/);
      expect(rest).toMatch(/rateLimitError/);
      // The broadcast check must reference the admin's id.
      expect(rest).toMatch(/checkAdminBroadcastRateLimit\(\s*session\.user\.id\s*\)/);
      // The recipient-group check must pass the event id.
      expect(rest).toMatch(/checkRecipientGroupRateLimit\(\s*session\.user\.id,\s*eventId,/);
      // The recipient check must run before the CommunicationLog write.
      const recipientCheckIndex = rest.indexOf('checkAllRecipientRateLimits');
      const communicationLogIndex = rest.indexOf('communicationLog.create');
      expect(recipientCheckIndex).toBeGreaterThan(-1);
      expect(communicationLogIndex).toBeGreaterThan(-1);
      expect(recipientCheckIndex).toBeLessThan(communicationLogIndex);
      // The TRPCError -> 429 mapping must exist so the JSON
      // shape matches what the rest of the admin UI handles.
      expect(rest).toMatch(/TOO_MANY_REQUESTS/);
      expect(rest).toMatch(/trpcErrorToResponse/);
    });

    it('invitation-token module exports buildInvitationUrl', async () => {
      const token = await fs.readFile(invitationTokenPath, 'utf-8');
      expect(token).toMatch(/export function buildInvitationUrl/);
      expect(token).toMatch(/function buildInvitationUrl\(token:\s*string\)/);
      expect(token).toMatch(/NEXTAUTH_URL/);
      expect(token).toMatch(/\/events\/invitation\//);
    });

    it('tRPC invitation.send writes the URL into CommunicationLog.body', async () => {
      const router = await fs.readFile(invitationRouterPath, 'utf-8');
      const sendBlock = router.split(/send:\s*auditedAdminProcedure/)[1] ?? '';
      const sendEnd = sendBlock.indexOf('resend:');
      const sendSlice = sendEnd >= 0 ? sendBlock.slice(0, sendEnd) : sendBlock;
      expect(sendSlice).toMatch(/buildInvitationUrl\(token\)/);
      expect(sendSlice).toMatch(/body:\s*buildInvitationUrl\(token\)/);
    });

    it('REST mirror at /api/admin/invitations/send writes the URL into CommunicationLog.body', async () => {
      const rest = await fs.readFile(invitationRestPath, 'utf-8');
      expect(rest).toMatch(/body:\s*buildInvitationUrl\(token\)/);
    });

    it('CommunicationLog model has a nullable body column', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const block = schema.match(/model CommunicationLog \{([\s\S]*?)^\}/m);
      expect(block).not.toBeNull();
      expect(block![1]!).toMatch(/body\s+String\?/);
    });

    it('migration adds the CommunicationLog.body column', async () => {
      const migrationPath = path.join(
        process.cwd(),
        'prisma/migrations/20260806090000_fpp88_decline_message_and_body/migration.sql',
      );
      const sql = await fs.readFile(migrationPath, 'utf-8');
      expect(sql).toMatch(/ALTER TABLE "CommunicationLog"\s+ADD COLUMN "body" TEXT/i);
    });
  });
});
