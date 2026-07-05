import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { STANDARD_DIETARY_LABELS, parseDietaryNotesToLabels, getDietarySummary } from '../dietary';
import type { DietaryAttendee } from '../dietary';

describe('STANDARD_DIETARY_LABELS', () => {
  it('contains all expected labels', () => {
    expect(STANDARD_DIETARY_LABELS).toEqual([
      'vegetarian',
      'vegan',
      'gluten_free',
      'contains_nuts',
      'dairy_free',
    ]);
  });

  it('is a readonly tuple type', () => {
    expect(STANDARD_DIETARY_LABELS.length).toBe(5);
  });
});

describe('parseDietaryNotesToLabels', () => {
  it('returns empty array for null input', () => {
    expect(parseDietaryNotesToLabels(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseDietaryNotesToLabels('')).toEqual([]);
  });

  it('parses "vegetarian"', () => {
    expect(parseDietaryNotesToLabels('vegetarian')).toEqual(['vegetarian']);
  });

  it('parses "vegan"', () => {
    expect(parseDietaryNotesToLabels('vegan')).toEqual(['vegan']);
  });

  it('parses "gluten free" as gluten_free', () => {
    expect(parseDietaryNotesToLabels('gluten free')).toEqual(['gluten_free']);
  });

  it('parses "celiac" as gluten_free', () => {
    expect(parseDietaryNotesToLabels('celiac')).toEqual(['gluten_free']);
  });

  it('parses "gf" as gluten_free', () => {
    expect(parseDietaryNotesToLabels('gf')).toEqual(['gluten_free']);
  });

  it('parses "nuts" as contains_nuts', () => {
    expect(parseDietaryNotesToLabels('nuts')).toEqual(['contains_nuts']);
  });

  it('parses "peanut" as contains_nuts', () => {
    expect(parseDietaryNotesToLabels('peanut')).toEqual(['contains_nuts']);
  });

  it('parses "allergy" as contains_nuts', () => {
    expect(parseDietaryNotesToLabels('allergy')).toEqual(['contains_nuts']);
  });

  it('parses "dairy" as dairy_free', () => {
    expect(parseDietaryNotesToLabels('dairy')).toEqual(['dairy_free']);
  });

  it('parses "lactose" as dairy_free', () => {
    expect(parseDietaryNotesToLabels('lactose')).toEqual(['dairy_free']);
  });

  it('parses "milk" as dairy_free', () => {
    expect(parseDietaryNotesToLabels('milk')).toEqual(['dairy_free']);
  });

  it('does NOT match "non-vegetarian" as vegetarian', () => {
    expect(parseDietaryNotesToLabels('non-vegetarian')).toEqual([]);
  });

  it('matches multiple labels from combined notes', () => {
    const result = parseDietaryNotesToLabels('vegetarian, gluten free, nuts');
    expect(result).toContain('vegetarian');
    expect(result).toContain('gluten_free');
    expect(result).toContain('contains_nuts');
    expect(result).toHaveLength(3);
  });

  it('is case insensitive', () => {
    expect(parseDietaryNotesToLabels('VEGETARIAN')).toEqual(['vegetarian']);
    expect(parseDietaryNotesToLabels('Vegan')).toEqual(['vegan']);
    expect(parseDietaryNotesToLabels('Gluten Free')).toEqual(['gluten_free']);
    expect(parseDietaryNotesToLabels('Dairy-Free')).toEqual(['dairy_free']);
  });
});

describe('getDietarySummary', () => {
  const makeAttendee = (overrides: Partial<DietaryAttendee> = {}): DietaryAttendee => ({
    id: '1',
    headcount: 1,
    dietaryNotes: null,
    respondedAt: new Date(),
    user: {
      id: 'u1',
      name: 'Test User',
      household: { name: 'Test Household' },
    },
    ...overrides,
  });

  it('returns all-zero counts for empty attendees', () => {
    const result = getDietarySummary([]);
    expect(result).toEqual({
      vegetarian: 0,
      vegan: 0,
      gluten_free: 0,
      contains_nuts: 0,
      dairy_free: 0,
    });
  });

  it('counts labels for a single attendee with multiple dietary notes', () => {
    const attendee = makeAttendee({
      id: 'a1',
      dietaryNotes: 'vegetarian, dairy free',
    });
    const result = getDietarySummary([attendee]);
    expect(result).toEqual({
      vegetarian: 1,
      vegan: 0,
      gluten_free: 0,
      contains_nuts: 0,
      dairy_free: 1,
    });
  });

  it('aggregates labels from multiple attendees with overlapping labels', () => {
    const attendees = [
      makeAttendee({ id: 'a1', dietaryNotes: 'vegetarian' }),
      makeAttendee({ id: 'a2', dietaryNotes: 'vegetarian, vegan' }),
      makeAttendee({ id: 'a3', dietaryNotes: 'gluten free' }),
    ];
    const result = getDietarySummary(attendees);
    expect(result).toEqual({
      vegetarian: 2,
      vegan: 1,
      gluten_free: 1,
      contains_nuts: 0,
      dairy_free: 0,
    });
  });

  it('does not count attendees with null dietaryNotes', () => {
    const attendees = [
      makeAttendee({ id: 'a1', dietaryNotes: 'vegan' }),
      makeAttendee({ id: 'a2', dietaryNotes: null }),
    ];
    const result = getDietarySummary(attendees);
    expect(result).toEqual({
      vegetarian: 0,
      vegan: 1,
      gluten_free: 0,
      contains_nuts: 0,
      dairy_free: 0,
    });
  });

  it('handles attendees with non-matching dietary notes', () => {
    const attendees = [makeAttendee({ id: 'a1', dietaryNotes: 'non-vegetarian' })];
    const result = getDietarySummary(attendees);
    expect(result).toEqual({
      vegetarian: 0,
      vegan: 0,
      gluten_free: 0,
      contains_nuts: 0,
      dairy_free: 0,
    });
  });
});
