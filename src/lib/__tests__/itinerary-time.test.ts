import { describe, it, expect } from 'vitest';
import { formatItineraryTime } from '~/lib/itinerary-time';

describe('formatItineraryTime', () => {
  it('formats morning hours', () => {
    expect(formatItineraryTime('10:00')).toBe('10:00 AM');
    expect(formatItineraryTime('00:30')).toBe('12:30 AM');
  });

  it('formats afternoon hours', () => {
    expect(formatItineraryTime('14:30')).toBe('2:30 PM');
    expect(formatItineraryTime('12:00')).toBe('12:00 PM');
  });

  it('accepts HH:MM:SS strings', () => {
    expect(formatItineraryTime('09:05:00')).toBe('9:05 AM');
  });

  it('passes malformed strings through unchanged', () => {
    expect(formatItineraryTime('not-a-time')).toBe('not-a-time');
  });

  it('handles missing minutes gracefully', () => {
    expect(formatItineraryTime('10')).toBe('10');
  });
});
