import { describe, expect, it } from 'vitest';
import {
  rsvpConfirmSchema,
  rsvpDeclineSchema,
  potluckSignupSchema,
  dependentCreateSchema,
  dependentUpdateSchema,
  profileUpdateSchema,
  photoReactionSchema,
  VALID_REACTIONS,
  eventCreateSchema,
  eventUpdateSchema,
} from '~/lib/schemas';

describe('RSVP Schemas', () => {
  describe('rsvpConfirmSchema', () => {
    it('validates correct confirm input', () => {
      const result = rsvpConfirmSchema.safeParse({
        eventId: 'event-123',
        headcount: 2,
        dietaryNotes: 'vegetarian',
      });
      expect(result.success).toBe(true);
    });

    it('applies default headcount', () => {
      const result = rsvpConfirmSchema.safeParse({ eventId: 'event-123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.headcount).toBe(1);
        expect(result.data.dietaryNotes).toBeUndefined();
      }
    });

    it('rejects missing eventId', () => {
      const result = rsvpConfirmSchema.safeParse({ headcount: 2 });
      expect(result.success).toBe(false);
    });

    it('rejects headcount less than 1', () => {
      const result = rsvpConfirmSchema.safeParse({ eventId: 'event-123', headcount: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer headcount', () => {
      const result = rsvpConfirmSchema.safeParse({ eventId: 'event-123', headcount: 1.5 });
      expect(result.success).toBe(false);
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

    it('validates cancel action', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'cancel',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid action', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty dishName for signup', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'signup',
        dishName: '',
      });
      expect(result.success).toBe(false);
    });

    it('applies defaults', () => {
      const result = potluckSignupSchema.safeParse({
        slotId: 'slot-123',
        action: 'signup',
        dishName: 'Salad',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.servings).toBe(1);
        expect(result.data.dietaryLabels).toEqual([]);
      }
    });
  });
});

describe('Dependent Schemas', () => {
  describe('dependentCreateSchema', () => {
    it('validates correct dependent creation', () => {
      const result = dependentCreateSchema.safeParse({
        name: 'Emma',
        relationship: 'CHILD',
        age: 8,
        dietaryLabels: ['nut-free'],
        isChild: true,
      });
      expect(result.success).toBe(true);
    });

    it('validates without optional fields', () => {
      const result = dependentCreateSchema.safeParse({
        name: 'Spouse',
        relationship: 'SPOUSE',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = dependentCreateSchema.safeParse({
        name: '',
        relationship: 'CHILD',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid relationship', () => {
      const result = dependentCreateSchema.safeParse({
        name: 'Test',
        relationship: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative age', () => {
      const result = dependentCreateSchema.safeParse({
        name: 'Test',
        relationship: 'CHILD',
        age: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('dependentUpdateSchema', () => {
    it('validates partial update', () => {
      const result = dependentUpdateSchema.safeParse({
        id: 'dep-123',
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('validates update with all fields', () => {
      const result = dependentUpdateSchema.safeParse({
        id: 'dep-123',
        name: 'Updated',
        relationship: 'CHILD',
        age: 10,
        dietaryLabels: ['gluten-free'],
        isChild: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing id', () => {
      const result = dependentUpdateSchema.safeParse({
        name: 'Updated',
      });
      expect(result.success).toBe(false);
    });

    it('allows nulling age', () => {
      const result = dependentUpdateSchema.safeParse({
        id: 'dep-123',
        age: null,
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
      const result = profileUpdateSchema.safeParse({ communicationPreference: 'SMS' });
      expect(result.success).toBe(true);
    });

    it('validates both fields', () => {
      const result = profileUpdateSchema.safeParse({
        name: 'New Name',
        communicationPreference: 'BOTH',
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
