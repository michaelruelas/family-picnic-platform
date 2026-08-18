import { describe, it, expect } from 'vitest';
import { formatUsPhone, toE164, countDigitsBefore, indexAfterDigits } from '../phone-format';

describe('formatUsPhone', () => {
  it('returns an empty string for empty input', () => {
    expect(formatUsPhone('')).toBe('');
  });

  it('returns an empty string when the input has no digits', () => {
    expect(formatUsPhone('(')).toBe('');
    expect(formatUsPhone('   ')).toBe('');
    expect(formatUsPhone('( - )')).toBe('');
  });

  it('renders just the +1 prefix once the user types a single digit', () => {
    expect(formatUsPhone('5')).toBe('+1 (5');
  });

  it('opens the area-code parens when at least one digit is present', () => {
    expect(formatUsPhone('55')).toBe('+1 (55');
  });

  it('closes the area-code parens after the third digit', () => {
    expect(formatUsPhone('555')).toBe('+1 (555)');
  });

  it('starts the prefix group with a space once the area code is closed', () => {
    expect(formatUsPhone('5551')).toBe('+1 (555) 1');
    expect(formatUsPhone('55512')).toBe('+1 (555) 12');
    expect(formatUsPhone('555123')).toBe('+1 (555) 123');
  });

  it('inserts the dash after the sixth digit', () => {
    expect(formatUsPhone('5551234')).toBe('+1 (555) 123-4');
    expect(formatUsPhone('5551234567')).toBe('+1 (555) 123-4567');
  });

  it('handles a leading 1 as the US country code', () => {
    expect(formatUsPhone('15551234567')).toBe('+1 (555) 123-4567');
  });

  it('handles a leading +1 as the US country code', () => {
    expect(formatUsPhone('+15551234567')).toBe('+1 (555) 123-4567');
  });

  it('handles pasted formatted input', () => {
    expect(formatUsPhone('(555) 123-4567')).toBe('+1 (555) 123-4567');
    expect(formatUsPhone('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
    expect(formatUsPhone('555.123.4567')).toBe('+1 (555) 123-4567');
  });

  it('treats a leading +1 as the country code, not the start of the area code', () => {
    // Regression: the formatter is re-run on every keystroke of a
    // controlled input, so the input value is the previous display
    // (already prefixed with "+1") plus the new character. The
    // "+1" must be stripped before digit extraction so the country
    // code is not absorbed into the area code.
    expect(formatUsPhone('+1 (5')).toBe('+1 (5');
    expect(formatUsPhone('+1 (55')).toBe('+1 (55');
    expect(formatUsPhone('+1 (559')).toBe('+1 (559)');
    expect(formatUsPhone('+1 (555) 1')).toBe('+1 (555) 1');
    expect(formatUsPhone('+1 (555) 123-4')).toBe('+1 (555) 123-4');
  });

  it('caps at 11 digits so a longer paste does not overflow', () => {
    expect(formatUsPhone('555123456789')).toBe('+1 (555) 123-4567');
    expect(formatUsPhone('15551234567890')).toBe('+1 (555) 123-4567');
  });
});

describe('toE164', () => {
  it('returns empty for empty formatted input', () => {
    expect(toE164('')).toBe('');
  });

  it('preserves a US number that already includes the country code', () => {
    expect(toE164('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('prepends the US country code when the user typed only 10 digits', () => {
    expect(toE164('(555) 123-4567')).toBe('+15551234567');
  });

  it('handles a partial local number', () => {
    expect(toE164('+1 (555')).toBe('+1555');
    expect(toE164('(555')).toBe('+1555');
  });

  it('handles just a leading +1', () => {
    expect(toE164('+1')).toBe('+1');
  });
});

describe('countDigitsBefore / indexAfterDigits', () => {
  const display = '+1 (555) 123-4567';

  it('counts digits before a position', () => {
    // Pos 0: nothing before
    expect(countDigitsBefore(display, 0)).toBe(0);
    // Pos 5 is right after "1 (5" → 2 digits ("1" at index 1, "5" at index 4)
    expect(countDigitsBefore(display, 5)).toBe(2);
    // Pos 9 is right after "(555) " → 4 digits
    expect(countDigitsBefore(display, 9)).toBe(4);
    // Full string → 11 digits
    expect(countDigitsBefore(display, display.length)).toBe(11);
  });

  it('clamps positions past the end to the digit count', () => {
    expect(countDigitsBefore(display, 9999)).toBe(11);
  });

  it('returns the index immediately after the Nth digit', () => {
    // After the 1st digit ("1"), index 2 in "+1 (..."
    expect(indexAfterDigits(display, 1)).toBe(2);
    // After the 4th digit (the third "5" in "(555)"), index 7
    expect(indexAfterDigits(display, 4)).toBe(7);
    // After all 11 digits, end of string
    expect(indexAfterDigits(display, 11)).toBe(display.length);
  });

  it('returns 0 when target is 0 and the string length when target overflows', () => {
    expect(indexAfterDigits(display, 0)).toBe(0);
    expect(indexAfterDigits(display, 9999)).toBe(display.length);
  });

  it('keeps the caret pinned to the same digit across a re-format', () => {
    // Simulate a delete: from "+1 (555) 123-4567" the user
    // backspaces one digit at the end. The raw input lands as
    // "+1 (555) 123-456" → re-format back to "+1 (555) 123-4567"
    // (the format hides trailing partial groups), and we want
    // the caret to land after the last surviving digit.
    const raw = '+1 (555) 123-456';
    const digitsBeforeCursor = countDigitsBefore(display, display.length);
    const formatted = formatUsPhone(raw);
    const newCursor = indexAfterDigits(formatted, digitsBeforeCursor - 1);
    expect(formatted).toBe('+1 (555) 123-456');
    expect(newCursor).toBe(formatted.length);
  });
});
