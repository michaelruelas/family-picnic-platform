import { describe, it, expect } from 'vitest';
import { extractFirstName } from '../first-name';

describe('extractFirstName (FPP-151)', () => {
  it('returns the first whitespace-delimited token', () => {
    expect(extractFirstName('Maria Garcia')).toBe('Maria');
    expect(extractFirstName('Carlos Garcia Lopez')).toBe('Carlos');
  });

  it('trims surrounding whitespace before splitting', () => {
    expect(extractFirstName('  Maria Garcia  ')).toBe('Maria');
    expect(extractFirstName('\tLisa\nSmith')).toBe('Lisa');
  });

  it('returns the full string when there is no whitespace', () => {
    expect(extractFirstName('Maria')).toBe('Maria');
  });

  it('returns an empty string for empty / whitespace-only input', () => {
    expect(extractFirstName('')).toBe('');
    expect(extractFirstName('   ')).toBe('');
  });
});
