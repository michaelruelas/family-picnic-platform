import { describe, expect, it } from 'vitest';
import * as barrel from '~/lib/schemas';
import {
  rsvpConfirmSchema,
  rsvpDeclineSchema,
  potluckSignupSchema,
  profileUpdateSchema,
  photoReactionSchema,
  VALID_REACTIONS,
  eventCreateSchema,
  eventUpdateSchema,
  householdCreateSchema,
  householdUpdateSchema,
  householdNameSchema,
} from '~/lib/schemas';

describe('RSVP Schemas', () => {
  describe('rsvpConfirmSchema', () => {
    it('validates correct confirm input', () => {
      const result = rsvpConfirmSchema.safeParse({
        eventId: 'event-123',
        headcount: 2,
      });
      expect(result.success).toBe(true);
    });

    it('defaults headcount to undefined (derived server-side)', () => {
      const result = rsvpConfirmSchema.safeParse({ eventId: 'event-123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.headcount).toBeUndefined();
      }
    });

    it('rejects missing eventId', () => {
      const result = rsvpConfirmSchema.safeParse({ headcount: 2 });
      expect(result.success).toBe(false);
    });

    it('rejects negative headcount', () => {
      const result = rsvpConfirmSchema.safeParse({ eventId: 'event-123', headcount: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer headcount', () => {
      const result = rsvpConfirmSchema.safeParse({ eventId: 'event-123', headcount: 1.5 });
      expect(result.success).toBe(false);
    });

    it('accepts headcount of 0 (memberAttendances will be used instead)', () => {
      const result = rsvpConfirmSchema.safeParse({ eventId: 'event-123', headcount: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('rsvpDeclineSchema', () => {
    it('validates correct decline input', () => {
      const result = rsvpDeclineSchema.safeParse({ eventId: 'event-123' });
      expect(result.success).toBe(true);
    });

    it('rejects missing eventId', () => {
      const result = rsvpDeclineSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

describe('Potluck Schema', () => {
  describe('potluckSignupSchema', () => {
    it('validates signup action', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'signup',
        dishName: 'Lasagna',
        servings: 3,
        dietaryLabels: ['vegetarian'],
      });
      expect(result.success).toBe(true);
    });

    it('validates cancel action (uses signupId, not slotId)', () => {
      // Multi-claim: cancel targets a single signup row by its `id`,
      // not by (slotId, rsvpId) like the legacy schema did.
      const result = potluckSignupSchema.safeParse({
        action: 'cancel',
        signupId: 'signup-123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects cancel without signupId', () => {
      const result = potluckSignupSchema.safeParse({
        action: 'cancel',
      });
      expect(result.success).toBe(false);
    });

    it('rejects signup without slotId', () => {
      const result = potluckSignupSchema.safeParse({
        action: 'signup',
        dishName: 'Cake',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid action', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty dishName for signup', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'signup',
        dishName: '',
      });
      expect(result.success).toBe(true);
    });

    it('applies defaults', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'signup',
        dishName: 'Salad',
      });
      expect(result.success).toBe(true);
      if (result.success && result.data.action === 'signup') {
        expect(result.data.servings).toBe(1);
        expect(result.data.dietaryLabels).toEqual([]);
      }
    });
  });
});

describe('Dependent Schemas', () => {
  describe('householdMemberCreateSchema', () => {
    it('validates correct household member creation', () => {
      const { householdMemberCreateSchema } = barrel;
      const result = householdMemberCreateSchema.safeParse({
        householdId: 'h-1',
        name: 'Emma',
        age: 8,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('householdMemberUpdateSchema', () => {
    it('validates partial update', () => {
      const { householdMemberUpdateSchema } = barrel;
      const result = householdMemberUpdateSchema.safeParse({
        id: 'mem-123',
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Profile Schema', () => {
  describe('profileUpdateSchema', () => {
    it('validates name update', () => {
      const result = profileUpdateSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('validates communication preference update', () => {
      const result = profileUpdateSchema.safeParse({
        communicationPreference: 'EMAIL',
      });
      expect(result.success).toBe(true);
    });

    it('validates both fields', () => {
      const result = profileUpdateSchema.safeParse({
        name: 'New Name',
        communicationPreference: 'BOTH',
        phoneNumber: '+15551234567',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = profileUpdateSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid communication preference', () => {
      const result = profileUpdateSchema.safeParse({ communicationPreference: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('accepts a valid E.164 phone number', () => {
      const result = profileUpdateSchema.safeParse({ phoneNumber: '+15551234567' });
      expect(result.success).toBe(true);
    });

    it('rejects a phone number that is not E.164', () => {
      const result = profileUpdateSchema.safeParse({ phoneNumber: '555-123-4567' });
      expect(result.success).toBe(false);
    });

    it('requires a phone number when opting in to SMS consent', () => {
      const result = profileUpdateSchema.safeParse({ smsConsent: true });
      expect(result.success).toBe(false);
    });

    it('requires a phone number when communication preference is SMS', () => {
      const result = profileUpdateSchema.safeParse({ communicationPreference: 'SMS' });
      expect(result.success).toBe(false);
    });

    it('requires a phone number when communication preference is BOTH', () => {
      const result = profileUpdateSchema.safeParse({ communicationPreference: 'BOTH' });
      expect(result.success).toBe(false);
    });

    it('accepts SMS consent with a valid E.164 phone number', () => {
      const result = profileUpdateSchema.safeParse({
        smsConsent: true,
        phoneNumber: '+15551234567',
      });
      expect(result.success).toBe(true);
    });

    it('allows opting out of SMS without a phone number', () => {
      const result = profileUpdateSchema.safeParse({ smsConsent: false });
      expect(result.success).toBe(true);
    });

    it('allows clearing an existing phone number with null', () => {
      const result = profileUpdateSchema.safeParse({ phoneNumber: null });
      expect(result.success).toBe(true);
    });
  });
});

describe('Photo Reaction Schema', () => {
  describe('photoReactionSchema', () => {
    it('validates valid reaction', () => {
      const result = photoReactionSchema.safeParse({
        photoId: 'photo-123',
        reaction: '❤️',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid reaction emoji', () => {
      const result = photoReactionSchema.safeParse({
        photoId: 'photo-123',
        reaction: '💩',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing photoId', () => {
      const result = photoReactionSchema.safeParse({
        reaction: '❤️',
      });
      expect(result.success).toBe(false);
    });

    it('exports VALID_REACTIONS constant', () => {
      expect(VALID_REACTIONS).toEqual(['❤️', '👍', '👏', '🎉', '😂']);
    });
  });
});

describe('Event Schemas', () => {
  describe('eventCreateSchema', () => {
    it('validates correct event input', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Mega Picnic',
        date: '2026-07-31T09:00',
        location: 'The Moon',
        description: 'Moon picnic',
        rsvpDeadline: '2026-07-15T05:00',
        maxCapacity: 6,
        mapImageUrl: 'https://example.com/map.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('validates minimal event input', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-31T09:00',
        location: 'Central Park',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing name', () => {
      const result = eventCreateSchema.safeParse({
        date: '2026-07-31T09:00',
        location: 'Central Park',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing date', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        location: 'Central Park',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing location', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-31T09:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects rsvpDeadline after event date', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-15T09:00',
        location: 'Central Park',
        rsvpDeadline: '2026-07-31T09:00',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0]!;
        expect(issue.message).toBe('RSVP deadline must be before the event date');
        expect(issue.path).toContain('rsvpDeadline');
      }
    });

    it('allows rsvpDeadline before event date', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Mega Picnic',
        date: '2026-07-31T09:00',
        location: 'The Moon',
        rsvpDeadline: '2026-07-15T05:00',
      });
      expect(result.success).toBe(true);
    });

    it('allows empty mapImageUrl', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-31T09:00',
        location: 'Central Park',
        mapImageUrl: '',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid mapImageUrl', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-31T09:00',
        location: 'Central Park',
        mapImageUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects maxCapacity less than 1', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-31T09:00',
        location: 'Central Park',
        maxCapacity: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative maxCapacity', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-31T09:00',
        location: 'Central Park',
        maxCapacity: -5,
      });
      expect(result.success).toBe(false);
    });

    it('applies default description', () => {
      const result = eventCreateSchema.safeParse({
        name: 'Test Event',
        date: '2026-07-31T09:00',
        location: 'Central Park',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('');
      }
    });
  });

  describe('eventUpdateSchema', () => {
    it('validates partial update with id', () => {
      const result = eventUpdateSchema.safeParse({
        id: 'event-123',
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('validates update with all fields', () => {
      const result = eventUpdateSchema.safeParse({
        id: 'event-123',
        name: 'Updated Event',
        date: '2026-08-15T10:00',
        location: 'New Location',
        description: 'New description',
        rsvpDeadline: '2026-08-01T10:00',
        maxCapacity: 20,
        mapImageUrl: 'https://example.com/new-map.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing id', () => {
      const result = eventUpdateSchema.safeParse({
        name: 'Updated Name',
      });
      expect(result.success).toBe(false);
    });

    it('validates rsvpDeadline after event date in update', () => {
      const result = eventUpdateSchema.safeParse({
        id: 'event-123',
        date: '2026-07-15T09:00',
        rsvpDeadline: '2026-07-31T09:00',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0]!;
        expect(issue.message).toBe('RSVP deadline must be before the event date');
      }
    });
  });
});

describe('Household Schemas', () => {
  describe('householdNameSchema', () => {
    it('accepts a normal name', () => {
      const result = householdNameSchema.safeParse('The Garcia Family');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('The Garcia Family');
      }
    });

    it('trims surrounding whitespace', () => {
      const result = householdNameSchema.safeParse('  The Smiths  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('The Smiths');
      }
    });

    it('rejects empty string', () => {
      const result = householdNameSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Household name is required');
      }
    });

    it('rejects whitespace-only string', () => {
      const result = householdNameSchema.safeParse('     ');
      expect(result.success).toBe(false);
    });

    it('accepts exactly 80 characters', () => {
      const result = householdNameSchema.safeParse('a'.repeat(80));
      expect(result.success).toBe(true);
    });

    it('rejects 81 characters', () => {
      const result = householdNameSchema.safeParse('a'.repeat(81));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/80 characters or fewer/);
      }
    });
  });

  describe('householdCreateSchema', () => {
    it('validates a name', () => {
      const result = householdCreateSchema.safeParse({ name: 'The Garcias' });
      expect(result.success).toBe(true);
    });

    it('accepts optional parentHouseholdId', () => {
      const result = householdCreateSchema.safeParse({
        name: 'Garcia Kids',
        parentHouseholdId: 'hh-1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = householdCreateSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('householdUpdateSchema', () => {
    it('requires an id and name', () => {
      const result = householdUpdateSchema.safeParse({
        id: 'hh-1',
        name: 'New Name',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing id', () => {
      const result = householdUpdateSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(false);
    });

    it('rejects name longer than 80 chars', () => {
      const result = householdUpdateSchema.safeParse({
        id: 'hh-1',
        name: 'a'.repeat(81),
      });
      expect(result.success).toBe(false);
    });
  });
});

// FPP-34: phone + comms consent collected on the RSVP form. The
// shared schema lives in src/lib/schemas/rsvp-contact.ts and is
// exported via the schemas barrel. We test both the validator and
// the diff helper that decides what to send to user.updatePreferences.
describe('rsvpContactSchema', () => {
  it('imports from the schemas barrel', async () => {
    const barrel = await import('~/lib/schemas');
    expect(barrel.rsvpContactSchema).toBeDefined();
    expect(barrel.diffContact).toBeDefined();
  });

  it('accepts an empty payload (the form defaults)', () => {
    const result = barrel.rsvpContactSchema.safeParse({ phone: '', smsConsent: false });
    expect(result.success).toBe(true);
  });

  it('accepts a valid E.164 phone when smsConsent is true', () => {
    const result = barrel.rsvpContactSchema.safeParse({
      phone: '+15551234567',
      smsConsent: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a phone that is not E.164 even when consent is true', () => {
    const result = barrel.rsvpContactSchema.safeParse({
      phone: '555-1234',
      smsConsent: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a phone without consent', () => {
    const result = barrel.rsvpContactSchema.safeParse({
      phone: '+15551234567',
      smsConsent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const consentIssue = result.error.issues.find((i) => i.path[0] === 'smsConsent');
      expect(consentIssue?.message).toMatch(/consent/i);
    }
  });

  it('rejects a phone without an explicit consent value', () => {
    const result = barrel.rsvpContactSchema.safeParse({ phone: '+15551234567' });
    expect(result.success).toBe(false);
  });

  it('accepts consent=true with no phone (legitimate: opt in without saving yet)', () => {
    const result = barrel.rsvpContactSchema.safeParse({ phone: '', smsConsent: true });
    expect(result.success).toBe(true);
  });

  it('trims whitespace before validating the phone', () => {
    const result = barrel.rsvpContactSchema.safeParse({
      phone: '  +15551234567  ',
      smsConsent: true,
    });
    expect(result.success).toBe(true);
  });
});

// diffContact is the "should we PATCH?" gate. Returning an empty
// patch is the success case for a no-op submit; returning a non-empty
// patch means the user changed something and we owe the server a
// round-trip.
describe('diffContact', () => {
  const cleanSnapshot = { phoneNumber: null as string | null, smsConsent: false };

  it('returns an empty patch when both fields are already in sync', () => {
    const patch = barrel.diffContact({ phone: '', smsConsent: false }, cleanSnapshot);
    expect(patch).toEqual({});
  });

  it('returns an empty patch when nothing changed on a filled profile', () => {
    const patch = barrel.diffContact(
      { phone: '+15551234567', smsConsent: true },
      { phoneNumber: '+15551234567', smsConsent: true },
    );
    expect(patch).toEqual({});
  });

  it('emits a phone + consent patch when the user adds a new phone', () => {
    const patch = barrel.diffContact({ phone: '+15551234567', smsConsent: true }, cleanSnapshot);
    expect(patch.phoneNumber).toBe('+15551234567');
    expect(patch.smsConsent).toBe(true);
    // The patch only carries phone + consent. smsConsentAt and
    // smsConsentIp are server-stamped from the request context, not
    // the form state.
    expect(patch).not.toHaveProperty('smsConsentAt');
    expect(patch).not.toHaveProperty('smsConsentIp');
  });

  it('clears phone and consent when the user removes a saved phone', () => {
    const patch = barrel.diffContact(
      { phone: '', smsConsent: false },
      { phoneNumber: '+15551234567', smsConsent: true },
    );
    expect(patch.phoneNumber).toBeNull();
    expect(patch.smsConsent).toBe(false);
    // Consent revocation timestamp / IP is wiped server-side. The
    // client patch only signals the intent; the server applies it.
    expect(patch).not.toHaveProperty('smsConsentAt');
    expect(patch).not.toHaveProperty('smsConsentIp');
  });

  it('trims the phone before comparing so a stray space does not trigger a PATCH', () => {
    const patch = barrel.diffContact(
      { phone: '  +15551234567  ', smsConsent: true },
      { phoneNumber: '+15551234567', smsConsent: true },
    );
    expect(patch).toEqual({});
  });

  it('only re-stamps smsConsent when the consent flag flipped, not when only the phone changed', () => {
    const patch = barrel.diffContact(
      { phone: '+15559876543', smsConsent: true },
      { phoneNumber: '+15551234567', smsConsent: true },
    );
    expect(patch.phoneNumber).toBe('+15559876543');
    expect(patch.smsConsent).toBeUndefined();
  });
});
