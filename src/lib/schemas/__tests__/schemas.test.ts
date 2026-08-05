import { describe, it, expect } from 'vitest';
import {
  dependentCreateSchema,
  dependentUpdateSchema,
  dependentDeleteSchema,
} from '~/lib/schemas/dependent';
import { eventCreateSchema, eventUpdateSchema } from '~/lib/schemas/event';
import {
  householdMemberCreateSchema,
  householdMemberUpdateSchema,
  householdMemberDeleteSchema,
} from '~/lib/schemas/household-member';
import { photoReactionSchema } from '~/lib/schemas/photo';
import { potluckSignupInputSchema } from '~/lib/schemas/potluck';
import { profileUpdateSchema } from '~/lib/schemas/profile';
import {
  rsvpConfirmSchema,
  rsvpDeclineSchema,
  rsvpUpdateSchema,
  rsvpAdminOverrideSchema,
} from '~/lib/schemas/rsvp';

describe('dependentCreateSchema', () => {
  it('passes with valid data', () => {
    const result = dependentCreateSchema.safeParse({
      name: 'Alice',
      relationship: 'CHILD',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all optional fields', () => {
    const result = dependentCreateSchema.safeParse({
      name: 'Bob',
      relationship: 'SPOUSE',
      age: 30,
      dietaryLabels: ['vegetarian'],
      isChild: false,
    });
    expect(result.success).toBe(true);
  });

  it('fails when name is missing', () => {
    const result = dependentCreateSchema.safeParse({
      relationship: 'CHILD',
    });
    expect(result.success).toBe(false);
  });

  it('fails when name is empty after trim', () => {
    const result = dependentCreateSchema.safeParse({
      name: '   ',
      relationship: 'CHILD',
    });
    expect(result.success).toBe(false);
  });

  it('fails when relationship is invalid', () => {
    const result = dependentCreateSchema.safeParse({
      name: 'Alice',
      relationship: 'FRIEND',
    });
    expect(result.success).toBe(false);
  });

  it('fails when age is not positive', () => {
    const result = dependentCreateSchema.safeParse({
      name: 'Alice',
      relationship: 'CHILD',
      age: -1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when age is not an integer', () => {
    const result = dependentCreateSchema.safeParse({
      name: 'Alice',
      relationship: 'CHILD',
      age: 5.5,
    });
    expect(result.success).toBe(false);
  });

  it('defaults dietaryLabels to empty array', () => {
    const result = dependentCreateSchema.parse({
      name: 'Alice',
      relationship: 'CHILD',
    });
    expect(result.dietaryLabels).toEqual([]);
  });

  it('defaults isChild to false', () => {
    const result = dependentCreateSchema.parse({
      name: 'Alice',
      relationship: 'CHILD',
    });
    expect(result.isChild).toBe(false);
  });
});

describe('dependentUpdateSchema', () => {
  it('passes with valid partial update', () => {
    const result = dependentUpdateSchema.safeParse({
      id: 'dep-1',
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all fields', () => {
    const result = dependentUpdateSchema.safeParse({
      id: 'dep-1',
      name: 'Alice',
      relationship: 'SIBLING',
      age: null,
      dietaryLabels: ['gluten-free'],
      isChild: true,
    });
    expect(result.success).toBe(true);
  });

  it('fails when id is empty', () => {
    const result = dependentUpdateSchema.safeParse({
      id: '',
      name: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('fails when age is zero', () => {
    const result = dependentUpdateSchema.safeParse({
      id: 'dep-1',
      age: 0,
    });
    expect(result.success).toBe(false);
  });

  it('allows age to be null', () => {
    const result = dependentUpdateSchema.safeParse({
      id: 'dep-1',
      age: null,
    });
    expect(result.success).toBe(true);
  });

  it('fails with invalid relationship', () => {
    const result = dependentUpdateSchema.safeParse({
      id: 'dep-1',
      relationship: 'UNKNOWN',
    });
    expect(result.success).toBe(false);
  });
});

describe('dependentDeleteSchema', () => {
  it('passes with valid id', () => {
    const result = dependentDeleteSchema.safeParse({ id: 'dep-1' });
    expect(result.success).toBe(true);
  });

  it('fails when id is empty', () => {
    const result = dependentDeleteSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('fails when id is missing', () => {
    const result = dependentDeleteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('eventCreateSchema', () => {
  it('passes with valid data', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      date: '2026-07-15',
      location: 'Central Park',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all optional fields', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      date: '2026-07-15',
      location: 'Central Park',
      description: 'Fun day',
      rsvpDeadline: '2026-07-01',
      maxCapacity: 100,
      mapImageUrl: 'https://example.com/map.png',
    });
    expect(result.success).toBe(true);
  });

  it('fails when name is missing', () => {
    const result = eventCreateSchema.safeParse({
      date: '2026-07-15',
      location: 'Central Park',
    });
    expect(result.success).toBe(false);
  });

  it('fails when date is missing', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      location: 'Central Park',
    });
    expect(result.success).toBe(false);
  });

  it('fails when location is missing', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      date: '2026-07-15',
    });
    expect(result.success).toBe(false);
  });

  it('fails when rsvpDeadline is after event date', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      date: '2026-07-01',
      location: 'Central Park',
      rsvpDeadline: '2026-07-15',
    });
    expect(result.success).toBe(false);
  });

  it('passes when rsvpDeadline equals event date', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      date: '2026-07-15',
      location: 'Central Park',
      rsvpDeadline: '2026-07-15',
    });
    expect(result.success).toBe(true);
  });

  it('passes when rsvpDeadline is before event date', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      date: '2026-07-15',
      location: 'Central Park',
      rsvpDeadline: '2026-07-01',
    });
    expect(result.success).toBe(true);
  });

  it('defaults description to empty string', () => {
    const result = eventCreateSchema.parse({
      name: 'Annual Picnic',
      date: '2026-07-15',
      location: 'Central Park',
    });
    expect(result.description).toBe('');
  });

  it('fails with invalid maxCapacity', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Annual Picnic',
      date: '2026-07-15',
      location: 'Central Park',
      maxCapacity: -10,
    });
    expect(result.success).toBe(false);
  });
});

describe('eventUpdateSchema', () => {
  it('passes with valid partial update', () => {
    const result = eventUpdateSchema.safeParse({
      id: 'evt-1',
      name: 'Updated Picnic',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all fields', () => {
    const result = eventUpdateSchema.safeParse({
      id: 'evt-1',
      name: 'Annual Picnic',
      date: '2026-07-15',
      location: 'Central Park',
      description: 'Updated',
      rsvpDeadline: '2026-07-01',
      maxCapacity: 150,
      mapImageUrl: 'https://example.com/new-map.png',
    });
    expect(result.success).toBe(true);
  });

  it('fails when id is missing', () => {
    const result = eventUpdateSchema.safeParse({
      name: 'Updated Picnic',
    });
    expect(result.success).toBe(false);
  });

  it('fails when rsvpDeadline is after event date', () => {
    const result = eventUpdateSchema.safeParse({
      id: 'evt-1',
      name: 'Annual Picnic',
      date: '2026-06-01',
      rsvpDeadline: '2026-07-01',
    });
    expect(result.success).toBe(false);
  });

  it('allows empty string mapImageUrl', () => {
    const result = eventUpdateSchema.safeParse({
      id: 'evt-1',
      mapImageUrl: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('photoReactionSchema', () => {
  it('passes with valid reaction', () => {
    const result = photoReactionSchema.safeParse({
      photoId: 'photo-1',
      reaction: '❤️',
    });
    expect(result.success).toBe(true);
  });

  it('passes with valid thumbs up', () => {
    const result = photoReactionSchema.safeParse({
      photoId: 'photo-1',
      reaction: '👍',
    });
    expect(result.success).toBe(true);
  });

  it('fails with invalid reaction', () => {
    const result = photoReactionSchema.safeParse({
      photoId: 'photo-1',
      reaction: 'BAD',
    });
    expect(result.success).toBe(false);
  });

  it('fails when photoId is empty', () => {
    const result = photoReactionSchema.safeParse({
      photoId: '',
      reaction: '❤️',
    });
    expect(result.success).toBe(false);
  });

  it('fails when reaction is missing', () => {
    const result = photoReactionSchema.safeParse({
      photoId: 'photo-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('potluckSignupInputSchema', () => {
  it('passes with valid signup', () => {
    const result = potluckSignupInputSchema.safeParse({
      slotId: 'slot-1',
      dishName: 'Potato Salad',
      servings: 2,
    });
    expect(result.success).toBe(true);
  });

  it('passes with all optional fields', () => {
    const result = potluckSignupInputSchema.safeParse({
      slotId: 'slot-1',
      dishName: 'Potato Salad',
      servings: 4,
      dietaryLabels: ['vegetarian', 'gluten-free'],
    });
    expect(result.success).toBe(true);
  });

  it('fails when dishName is missing', () => {
    const result = potluckSignupInputSchema.safeParse({
      slotId: 'slot-1',
      servings: 2,
    });
    expect(result.success).toBe(false);
  });

  it('fails when dishName is empty after trim', () => {
    const result = potluckSignupInputSchema.safeParse({
      slotId: 'slot-1',
      dishName: '   ',
      servings: 2,
    });
    expect(result.success).toBe(false);
  });

  it('fails when slotId is missing', () => {
    const result = potluckSignupInputSchema.safeParse({
      dishName: 'Potato Salad',
      servings: 2,
    });
    expect(result.success).toBe(false);
  });

  it('fails when servings is less than 1', () => {
    const result = potluckSignupInputSchema.safeParse({
      slotId: 'slot-1',
      dishName: 'Potato Salad',
      servings: 0,
    });
    expect(result.success).toBe(false);
  });

  it('defaults servings to 1 when not provided', () => {
    const result = potluckSignupInputSchema.parse({
      slotId: 'slot-1',
      dishName: 'Potato Salad',
    });
    expect(result.servings).toBe(1);
  });

  it('defaults dietaryLabels to empty array', () => {
    const result = potluckSignupInputSchema.parse({
      slotId: 'slot-1',
      dishName: 'Potato Salad',
    });
    expect(result.dietaryLabels).toEqual([]);
  });
});

describe('profileUpdateSchema', () => {
  it('passes with valid name update', () => {
    const result = profileUpdateSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('passes with valid communicationPreference', () => {
    const result = profileUpdateSchema.safeParse({
      communicationPreference: 'EMAIL',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all fields', () => {
    const result = profileUpdateSchema.safeParse({
      name: 'Alice',
      communicationPreference: 'EMAIL',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    expect(result.success).toBe(true);
  });

  it('requires phone when opting in to SMS', () => {
    const result = profileUpdateSchema.safeParse({
      communicationPreference: 'BOTH',
    });
    expect(result.success).toBe(false);
  });

  it('fails with invalid communicationPreference', () => {
    const result = profileUpdateSchema.safeParse({
      communicationPreference: 'FAX',
    });
    expect(result.success).toBe(false);
  });

  it('passes with empty body (all optional)', () => {
    const result = profileUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('fails when name is empty after trim', () => {
    const result = profileUpdateSchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
  });
});

describe('rsvpConfirmSchema', () => {
  it('passes with valid confirm', () => {
    const result = rsvpConfirmSchema.safeParse({
      eventId: 'evt-1',
    });
    expect(result.success).toBe(true);
  });

  it('passes with explicit headcount', () => {
    const result = rsvpConfirmSchema.safeParse({
      eventId: 'evt-1',
      headcount: 4,
    });
    expect(result.success).toBe(true);
  });

  it('passes with dietaryNotes', () => {
    const result = rsvpConfirmSchema.safeParse({
      eventId: 'evt-1',
      headcount: 2,
      dietaryNotes: 'Nut allergy',
    });
    expect(result.success).toBe(true);
  });

  it('passes with memberAttendances', () => {
    const result = rsvpConfirmSchema.safeParse({
      eventId: 'evt-1',
      memberAttendances: [
        { householdMemberId: 'mem-1', memberName: 'Pat', attending: 'YES' },
        { householdMemberId: 'mem-2', memberName: 'Sam', attending: 'NO' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('fails when eventId is empty', () => {
    const result = rsvpConfirmSchema.safeParse({ eventId: '' });
    expect(result.success).toBe(false);
  });

  it('fails when eventId is missing', () => {
    const result = rsvpConfirmSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails with negative headcount', () => {
    const result = rsvpConfirmSchema.safeParse({
      eventId: 'evt-1',
      headcount: -1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when memberAttendances is empty', () => {
    const result = rsvpConfirmSchema.safeParse({
      eventId: 'evt-1',
      memberAttendances: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('rsvpDeclineSchema', () => {
  it('passes with valid decline', () => {
    const result = rsvpDeclineSchema.safeParse({
      eventId: 'evt-1',
    });
    expect(result.success).toBe(true);
  });

  it('fails when eventId is empty', () => {
    const result = rsvpDeclineSchema.safeParse({ eventId: '' });
    expect(result.success).toBe(false);
  });

  it('fails when eventId is missing', () => {
    const result = rsvpDeclineSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('rsvpUpdateSchema', () => {
  it('passes with valid update', () => {
    const result = rsvpUpdateSchema.safeParse({
      eventId: 'evt-1',
      headcount: 3,
    });
    expect(result.success).toBe(true);
  });

  it('passes with dietaryNotes', () => {
    const result = rsvpUpdateSchema.safeParse({
      eventId: 'evt-1',
      headcount: 2,
      dietaryNotes: 'Gluten-free',
    });
    expect(result.success).toBe(true);
  });

  it('passes with memberAttendances', () => {
    const result = rsvpUpdateSchema.safeParse({
      eventId: 'evt-1',
      memberAttendances: [{ householdMemberId: 'mem-1', memberName: 'Pat', attending: 'YES' }],
    });
    expect(result.success).toBe(true);
  });

  it('passes without headcount when memberAttendances is provided', () => {
    const result = rsvpUpdateSchema.safeParse({
      eventId: 'evt-1',
      memberAttendances: [{ householdMemberId: 'mem-1', memberName: 'Pat', attending: 'YES' }],
    });
    expect(result.success).toBe(true);
  });

  it('fails when eventId is missing', () => {
    const result = rsvpUpdateSchema.safeParse({ headcount: 2 });
    expect(result.success).toBe(false);
  });

  it('fails with negative headcount', () => {
    const result = rsvpUpdateSchema.safeParse({
      eventId: 'evt-1',
      headcount: -1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when memberAttendances is empty', () => {
    const result = rsvpUpdateSchema.safeParse({
      eventId: 'evt-1',
      memberAttendances: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('rsvpAdminOverrideSchema', () => {
  it('passes with valid admin override (confirmed)', () => {
    const result = rsvpAdminOverrideSchema.safeParse({
      eventId: 'evt-1',
      userId: 'user-1',
      status: 'CONFIRMED',
    });
    expect(result.success).toBe(true);
  });

  it('passes with valid admin override (declined)', () => {
    const result = rsvpAdminOverrideSchema.safeParse({
      eventId: 'evt-1',
      userId: 'user-1',
      status: 'DECLINED',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all optional fields', () => {
    const result = rsvpAdminOverrideSchema.safeParse({
      eventId: 'evt-1',
      userId: 'user-1',
      status: 'CONFIRMED',
      headcount: 5,
      dietaryNotes: 'Vegan',
    });
    expect(result.success).toBe(true);
  });

  it('fails with invalid status', () => {
    const result = rsvpAdminOverrideSchema.safeParse({
      eventId: 'evt-1',
      userId: 'user-1',
      status: 'PENDING',
    });
    expect(result.success).toBe(false);
  });

  it('fails when eventId is empty', () => {
    const result = rsvpAdminOverrideSchema.safeParse({
      eventId: '',
      userId: 'user-1',
      status: 'CONFIRMED',
    });
    expect(result.success).toBe(false);
  });

  it('fails when userId is missing', () => {
    const result = rsvpAdminOverrideSchema.safeParse({
      eventId: 'evt-1',
      status: 'CONFIRMED',
    });
    expect(result.success).toBe(false);
  });

  it('fails when status is missing', () => {
    const result = rsvpAdminOverrideSchema.safeParse({
      eventId: 'evt-1',
      userId: 'user-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('householdMemberCreateSchema', () => {
  it('passes with required fields only', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alex',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all fields', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alex',
      age: 7,
      notes: 'Allergic to nuts',
    });
    expect(result.success).toBe(true);
  });

  it('allows null age and notes', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alex',
      age: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('fails when name is missing', () => {
    const result = householdMemberCreateSchema.safeParse({ householdId: 'h-1' });
    expect(result.success).toBe(false);
  });

  it('fails when name is empty after trim', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('fails when householdId is missing', () => {
    const result = householdMemberCreateSchema.safeParse({ name: 'Alex' });
    expect(result.success).toBe(false);
  });

  it('fails when age is negative', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alex',
      age: -1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when age exceeds 120', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alex',
      age: 121,
    });
    expect(result.success).toBe(false);
  });

  it('fails when age is not an integer', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alex',
      age: 7.5,
    });
    expect(result.success).toBe(false);
  });

  it('fails when notes exceed 500 chars', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alex',
      notes: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('householdMemberUpdateSchema', () => {
  it('passes with id only', () => {
    const result = householdMemberUpdateSchema.safeParse({ id: 'm-1' });
    expect(result.success).toBe(true);
  });

  it('passes with partial fields', () => {
    const result = householdMemberUpdateSchema.safeParse({
      id: 'm-1',
      name: 'Alex Garcia',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all fields including null to clear', () => {
    const result = householdMemberUpdateSchema.safeParse({
      id: 'm-1',
      name: 'Alex',
      age: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('fails when id is missing', () => {
    const result = householdMemberUpdateSchema.safeParse({ name: 'Alex' });
    expect(result.success).toBe(false);
  });

  it('fails when name is empty after trim', () => {
    const result = householdMemberUpdateSchema.safeParse({
      id: 'm-1',
      name: '   ',
    });
    expect(result.success).toBe(false);
  });
});

describe('householdMemberDeleteSchema', () => {
  it('passes with valid id', () => {
    const result = householdMemberDeleteSchema.safeParse({ id: 'm-1' });
    expect(result.success).toBe(true);
  });

  it('fails when id is empty', () => {
    const result = householdMemberDeleteSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('fails when id is missing', () => {
    const result = householdMemberDeleteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

import {
  rsvpMemberAttendanceInputSchema,
  rsvpMemberAttendanceListSchema,
  attendingLabel,
} from '~/lib/schemas/rsvp-member-attendance';

describe('rsvpMemberAttendanceInputSchema', () => {
  it('passes with a YES attendance for a household member', () => {
    const result = rsvpMemberAttendanceInputSchema.safeParse({
      householdMemberId: 'mem-1',
      memberName: 'Pat',
      memberAge: 30,
      attending: 'YES',
    });
    expect(result.success).toBe(true);
  });

  it('passes with NO and MAYBE', () => {
    for (const attending of ['NO', 'MAYBE'] as const) {
      const result = rsvpMemberAttendanceInputSchema.safeParse({
        householdMemberId: 'mem-1',
        memberName: 'Pat',
        attending,
      });
      expect(result.success).toBe(true);
    }
  });

  it('allows an ad-hoc member without a householdMemberId', () => {
    const result = rsvpMemberAttendanceInputSchema.safeParse({
      householdMemberId: null,
      memberName: 'Plus One',
      attending: 'YES',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown attending value', () => {
    const result = rsvpMemberAttendanceInputSchema.safeParse({
      householdMemberId: 'mem-1',
      memberName: 'Pat',
      attending: 'YES_NO_MAYBE',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = rsvpMemberAttendanceInputSchema.safeParse({
      householdMemberId: 'mem-1',
      memberName: '   ',
      attending: 'YES',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative age', () => {
    const result = rsvpMemberAttendanceInputSchema.safeParse({
      householdMemberId: 'mem-1',
      memberName: 'Pat',
      memberAge: -1,
      attending: 'YES',
    });
    expect(result.success).toBe(false);
  });
});

describe('rsvpMemberAttendanceListSchema', () => {
  it('rejects an empty array', () => {
    const result = rsvpMemberAttendanceListSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it('accepts a single member', () => {
    const result = rsvpMemberAttendanceListSchema.safeParse([
      { memberName: 'Pat', attending: 'YES' },
    ]);
    expect(result.success).toBe(true);
  });
});

describe('attendingLabel', () => {
  it('returns human labels for each enum value', () => {
    expect(attendingLabel('YES')).toBe('Going');
    expect(attendingLabel('NO')).toBe('Not going');
    expect(attendingLabel('MAYBE')).toBe('Maybe');
  });
});

// FPP-36: the shared attendee-name schema enforces trim, max length,
// and no-control-characters on every entry point (RSVP form rows,
// household-member create / update).
import { attendeeNameSchema, ATTENDEE_NAME_MAX } from '~/lib/schemas/attendee-name';

describe('attendeeNameSchema (FPP-36)', () => {
  it('passes with a normal name', () => {
    const result = attendeeNameSchema.safeParse('Alice');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Alice');
  });

  it('trims leading and trailing whitespace', () => {
    const result = attendeeNameSchema.safeParse('   Alice   ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Alice');
  });

  it('rejects an empty string', () => {
    const result = attendeeNameSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only input', () => {
    const result = attendeeNameSchema.safeParse('     ');
    expect(result.success).toBe(false);
  });

  it('accepts a name at exactly the max length', () => {
    const name = 'a'.repeat(ATTENDEE_NAME_MAX);
    const result = attendeeNameSchema.safeParse(name);
    expect(result.success).toBe(true);
  });

  it('rejects a name one character over the max length', () => {
    const name = 'a'.repeat(ATTENDEE_NAME_MAX + 1);
    const result = attendeeNameSchema.safeParse(name);
    expect(result.success).toBe(false);
  });

  it('rejects ASCII control characters (0x00-0x1F, 0x7F)', () => {
    for (const code of [0x00, 0x07, 0x09, 0x0a, 0x0d, 0x1f, 0x7f]) {
      const value = `Alice${String.fromCharCode(code)}Bob`;
      const result = attendeeNameSchema.safeParse(value);
      expect(result.success).toBe(false);
    }
  });

  it('rejects Unicode line separators and narrow spaces', () => {
    for (const char of ['\u2028', '\u2029', '\u202f', '\u205f', '\u3000']) {
      const value = `Alice${char}Bob`;
      const result = attendeeNameSchema.safeParse(value);
      expect(result.success).toBe(false);
    }
  });

  it('accepts common punctuation and diacritics', () => {
    const result = attendeeNameSchema.safeParse('María-José O\u2019Brien');
    expect(result.success).toBe(true);
  });
});

describe('household-member schemas reuse attendee-name rules (FPP-36)', () => {
  it('rejects empty name on create', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects control characters on create', () => {
    const result = householdMemberCreateSchema.safeParse({
      householdId: 'h-1',
      name: 'Alice\u2028Bob',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an oversized name on update', () => {
    const result = householdMemberUpdateSchema.safeParse({
      id: 'm-1',
      name: 'a'.repeat(ATTENDEE_NAME_MAX + 1),
    });
    expect(result.success).toBe(false);
  });
});
