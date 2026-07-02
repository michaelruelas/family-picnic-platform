import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Invitation Single-Use Token', () => {
  const invitationRouterPath = path.join(
    process.cwd(),
    'src/server/routers/invitation.router.ts'
  );
  const rsvpRouterPath = path.join(
    process.cwd(),
    'src/server/routers/rsvp.router.ts'
  );
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const tokenUtilPath = path.join(
    process.cwd(),
    'src/lib/invitation-token.ts'
  );

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
});
