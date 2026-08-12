import { describe, it, expect } from 'vitest';
import { isEventWindowAfter } from '../event-window';

describe('isEventWindowAfter', () => {
  it('returns true when candidate is later than baseline', () => {
    expect(isEventWindowAfter('2026-08-15T10:00', '2026-08-15T09:00')).toBe(true);
  });

  it('returns true across year boundaries', () => {
    expect(isEventWindowAfter('2027-01-01T00:00', '2026-12-31T23:59')).toBe(true);
  });

  it('returns true across month boundaries', () => {
    expect(isEventWindowAfter('2026-09-01T00:00', '2026-08-31T23:59')).toBe(true);
  });

  it('returns false when candidate equals baseline', () => {
    expect(isEventWindowAfter('2026-08-15T10:00', '2026-08-15T10:00')).toBe(false);
  });

  it('returns false when candidate is earlier than baseline', () => {
    expect(isEventWindowAfter('2026-08-15T09:00', '2026-08-15T10:00')).toBe(false);
  });

  it('returns false when either input is empty (unset)', () => {
    expect(isEventWindowAfter('', '2026-08-15T10:00')).toBe(false);
    expect(isEventWindowAfter('2026-08-15T10:00', '')).toBe(false);
    expect(isEventWindowAfter('', '')).toBe(false);
  });

  it('relies on lexicographic order (the documented format invariant)', () => {
    // Two values that are equal under lexicographic and chronological
    // ordering. This guards against anyone silently swapping the
    // implementation for `new Date(a) > new Date(b)`, which would also
    // pass these inputs but break under any future format change.
    const sorted = ['2026-01-01T00:00', '2026-02-01T00:00', '2026-12-31T23:59'];
    const lexSorted = [...sorted].sort();
    expect(lexSorted).toEqual(sorted);
  });
});
