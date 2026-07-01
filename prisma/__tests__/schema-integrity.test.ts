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

  it('defines InvitationStatus as PENDING, SENT, DELIVERED', () => {
    const match = schema.match(/enum InvitationStatus \{([^}]+)\}/);
    expect(match![1]!.trim()).toContain('PENDING');
    expect(match![1]!.trim()).toContain('SENT');
    expect(match![1]!.trim()).toContain('DELIVERED');
  });

  it('defines CommunicationStatus with UNSUBSCRIBED', () => {
    const match = schema.match(/enum CommunicationStatus \{([^}]+)\}/);
    expect(match![1]!.trim()).toContain('UNSUBSCRIBED');
  });

  it('RSVP model has householdId and dietaryNotes', () => {
    expect(schema).toContain('householdId');
    expect(schema).toContain('dietaryNotes');
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
});
