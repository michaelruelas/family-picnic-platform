import { describe, expect, it } from 'vitest';
import {
  rsvpConfirmSchema,
  rsvpDeclineSchema,
  rsvpUpdateSchema,
  potluckSignupSchema,
  dependentCreateSchema,
  dependentUpdateSchema,
  profileUpdateSchema,
  photoReactionSchema,
  VALID_REACTIONS,
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
