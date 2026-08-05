import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCHEMA_PATH = path.resolve(__dirname, '../schema.prisma');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

describe('Prisma schema integrity vs SPEC', () => {
  it('defines the correct Role enum (ADMIN_ADULT, ADMIN)', () => {
    const match = schema.match(/enum Role \{([^}]+)\}/);
    expect(match).not.toBeNull();
    expect(match![1]!.trim()).toContain('ADMIN_ADULT');
    expect(match![1]!.trim()).toContain('ADMIN');
  });

  it('defines InvitationStatus as PENDING, SENT, DELIVERED, USED, EXPIRED', () => {
    const match = schema.match(/enum InvitationStatus \{([^}]+)\}/);
    expect(match![1]!.trim()).toContain('PENDING');
    expect(match![1]!.trim()).toContain('SENT');
    expect(match![1]!.trim()).toContain('DELIVERED');
    expect(match![1]!.trim()).toContain('USED');
    expect(match![1]!.trim()).toContain('EXPIRED');
  });

  it('defines CommunicationStatus with UNSUBSCRIBED', () => {
    const match = schema.match(/enum CommunicationStatus \{([^}]+)\}/);
    expect(match![1]!.trim()).toContain('UNSUBSCRIBED');
  });

  it('RSVP model has householdId', () => {
    expect(schema).toContain('householdId');
  });

  it('RSVP model does not have dietaryNotes (FPP-55 removed the field)', () => {
    expect(schema).not.toContain('dietaryNotes');
  });

  it('Event model uses description (not details)', () => {
    expect(schema).toMatch(/model Event \{[\s\S]*?description\s+String/);
    expect(schema).not.toContain('details');
  });

  it('Photo model has photoPrismId and caption', () => {
    expect(schema).toContain('photoPrismId');
    expect(schema).toContain('caption');
  });

  it('CommunicationLog has messageId', () => {
    expect(schema).toContain('messageId');
  });

  it('User model has phoneNumber and smsConsent columns', () => {
    const block = schema.match(/model User \{([\s\S]*?)^\}/m);
    expect(block).not.toBeNull();
    expect(block![1]!).toMatch(/phoneNumber\s+String\?/);
    expect(block![1]!).toMatch(/smsConsent\s+Boolean\s+@default\(false\)/);
    expect(block![1]!).toMatch(/smsConsentAt\s+DateTime\?/);
    expect(block![1]!).toMatch(/smsConsentIp\s+String\?/);
  });

  it('CommunicationLog records outbound and recipient phone numbers', () => {
    const block = schema.match(/model CommunicationLog \{([\s\S]*?)^\}/m);
    expect(block).not.toBeNull();
    expect(block![1]!).toMatch(/toPhoneNumber\s+String\?/);
    expect(block![1]!).toMatch(/fromPhoneNumber\s+String\?/);
  });

  it('PotluckSignup references RSVP via rsvpId (not userId)', () => {
    const block = schema.match(/model PotluckSignup \{([^}]+)\}/);
    expect(block).not.toBeNull();
    expect(block![1]!).toContain('rsvpId');
    expect(block![1]!).not.toContain('userId');
  });

  it('PotluckSignup uses servings (not servesHowMany)', () => {
    expect(schema).toMatch(/servings\s+Int/);
    expect(schema).not.toContain('servesHowMany');
  });

  it('PhotoReaction uses String reaction (not enum)', () => {
    expect(schema).toMatch(/reaction\s+String/);
  });

  it('enforces @@unique constraints on RSVP (eventId + userId)', () => {
    expect(schema).toContain('@@unique([eventId, userId])');
  });

  it('defines AdminPermission enum with OWNER, COADMIN, INVITER', () => {
    const match = schema.match(/enum AdminPermission \{([^}]+)\}/);
    expect(match).not.toBeNull();
    expect(match![1]!.trim()).toContain('OWNER');
    expect(match![1]!.trim()).toContain('COADMIN');
    expect(match![1]!.trim()).toContain('INVITER');
  });

  it('defines EventAdmin model with eventId, userId, and role', () => {
    const block = schema.match(/model EventAdmin \{([^}]+)\}/);
    expect(block).not.toBeNull();
    expect(block![1]!).toContain('eventId');
    expect(block![1]!).toContain('userId');
    expect(block![1]!).toContain('role');
    expect(block![1]!).toContain('AdminPermission');
  });

  it('EventAdmin has @@unique constraint on eventId + userId', () => {
    expect(schema).toContain('@@unique([eventId, userId])');
  });

  it('Event model has admins relation', () => {
    expect(schema).toMatch(/model Event \{[\s\S]*?admins\s+EventAdmin\[\]/);
  });

  it('User model has eventAdmins relation', () => {
    expect(schema).toMatch(/model User \{[\s\S]*?eventAdmins\s+EventAdmin\[\]/);
  });
});
