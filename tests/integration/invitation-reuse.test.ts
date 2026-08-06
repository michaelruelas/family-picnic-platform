import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Invitation Single-Use Token', () => {
  const invitationRouterPath = path.join(process.cwd(), 'src/server/routers/invitation.router.ts');
  const rsvpRouterPath = path.join(process.cwd(), 'src/server/routers/rsvp.router.ts');
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const tokenUtilPath = path.join(process.cwd(), 'src/lib/invitation-token.ts');

  it('generates token and expiresAt on invitation send', async () => {
    const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
    expect(routerContent).toContain('generateInvitationToken()');
    expect(routerContent).toContain('getInvitationExpiry(30)');
  });

  it('InvitationStatus enum includes USED and EXPIRED', async () => {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    expect(schemaContent).toMatch(/enum InvitationStatus \{[^}]*USED[^}]*\}/);
    expect(schemaContent).toMatch(/enum InvitationStatus \{[^}]*EXPIRED[^}]*\}/);
  });

  it('Invitation model has token field', async () => {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    expect(schemaContent).toMatch(/model Invitation \{[\s\S]*token\s+String\?[^}]*\}/);
  });

  it('Invitation model has expiresAt field', async () => {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    expect(schemaContent).toMatch(/model Invitation \{[\s\S]*expiresAt\s+DateTime\?[^}]*\}/);
  });

  it('has consume procedure that checks for USED status', async () => {
    const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
    expect(routerContent).toContain('consume');
    expect(routerContent).toContain('InvitationStatus.USED');
    expect(routerContent).toContain('This invitation has already been used');
  });

  it('has consume procedure that checks for EXPIRED status', async () => {
    const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
    expect(routerContent).toContain('InvitationStatus.EXPIRED');
    expect(routerContent).toContain('This invitation has expired');
  });

  it('has consume procedure that checks token expiry', async () => {
    const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
    expect(routerContent).toContain('expiresAt');
    expect(routerContent).toContain('new Date(invitation.expiresAt) < new Date()');
  });

  it('RSVP create marks invitation as USED', async () => {
    const rsvpContent = await fs.readFile(rsvpRouterPath, 'utf-8');
    expect(rsvpContent).toContain('InvitationStatus.USED');
    expect(rsvpContent).toContain('invitation.updateMany');
  });

  it('RSVP confirm marks invitation as USED', async () => {
    const rsvpContent = await fs.readFile(rsvpRouterPath, 'utf-8');
    expect(rsvpContent).toContain('InvitationStatus.PENDING');
    expect(rsvpContent).toContain('status: InvitationStatus.USED');
  });

  it('token utility generates unique tokens', async () => {
    const tokenUtilContent = await fs.readFile(tokenUtilPath, 'utf-8');
    expect(tokenUtilContent).toContain('generateInvitationToken');
    expect(tokenUtilContent).toContain('Date.now()');
  });

  it('token utility provides configurable expiry', async () => {
    const tokenUtilContent = await fs.readFile(tokenUtilPath, 'utf-8');
    expect(tokenUtilContent).toContain('getInvitationExpiry');
    expect(tokenUtilContent).toContain('days');
  });

  describe('FPP-88: validate/commit split + URL body', () => {
    it('invitation router exposes a read-only validate procedure', async () => {
      const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
      expect(routerContent).toMatch(/validate:\s*auditedAdminProcedure/);
      // The validate procedure is a `.query`, not a `.mutation`,
      // so callers cannot accidentally burn the token by
      // pre-flighting the invitation. Bound the slice to the
      // validate body only (everything before `consume:`).
      const validateSlice = routerContent.split(/validate:\s*auditedAdminProcedure/)[1] ?? '';
      const validateEnd = validateSlice.indexOf('consume:');
      const validateBlock = validateEnd >= 0 ? validateSlice.slice(0, validateEnd) : validateSlice;
      expect(validateBlock).toMatch(/\.query\(/);
      expect(validateBlock).not.toMatch(/\.mutation\(/);
    });

    it('validate procedure does NOT mark the invitation as USED', async () => {
      const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
      // Extract the validate body and assert it never calls
      // prisma.invitation.update. The read-only landing page
      // must not burn the token.
      const validateBody = routerContent.split(/validate:\s*auditedAdminProcedure/)[1] ?? '';
      const validateEnd = validateBody.indexOf('consume:');
      const validateBlock = validateEnd >= 0 ? validateBody.slice(0, validateEnd) : validateBody;
      expect(validateBlock).not.toMatch(/prisma\.invitation\.update/);
      // The validate body must also avoid persisting EXPIRED so
      // a transient clock skew does not lock the user out.
      expect(validateBlock).not.toMatch(/status:\s*InvitationStatus\.EXPIRED/);
    });

    it('consume procedure still marks the invitation as USED (post-validate commit)', async () => {
      const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
      const consumeBlock = routerContent.split(/consume:\s*auditedAdminProcedure/)[1] ?? '';
      expect(consumeBlock).toMatch(/status:\s*InvitationStatus\.USED/);
      // The commit path is still a mutation.
      expect(consumeBlock).toMatch(/\.mutation\(/);
    });

    it('invitation.send writes the wizard URL into CommunicationLog.body', async () => {
      const routerContent = await fs.readFile(invitationRouterPath, 'utf-8');
      const sendBlock = routerContent.split(/send:\s*auditedAdminProcedure/)[1] ?? '';
      const sendEnd = sendBlock.indexOf('resend:');
      const sendSlice = sendEnd >= 0 ? sendBlock.slice(0, sendEnd) : sendBlock;
      expect(sendSlice).toMatch(/body:\s*buildInvitationUrl\(token\)/);
    });

    it('REST mirror at /api/admin/invitations/send also writes the URL', async () => {
      const restPath = path.join(process.cwd(), 'src/app/api/admin/invitations/send/route.ts');
      const restContent = await fs.readFile(restPath, 'utf-8');
      expect(restContent).toMatch(/body:\s*buildInvitationUrl\(token\)/);
    });

    it('buildInvitationUrl helper joins NEXTAUTH_URL with /events/invitation/<token>', async () => {
      const tokenUtilContent = await fs.readFile(tokenUtilPath, 'utf-8');
      expect(tokenUtilContent).toMatch(/export function buildInvitationUrl/);
      expect(tokenUtilContent).toMatch(/\/events\/invitation\//);
      // The helper accepts the token as its single argument.
      expect(tokenUtilContent).toMatch(/function buildInvitationUrl\(token:\s*string\)/);
    });
  });
});
