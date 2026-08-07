import { describe, it, expect } from 'vitest';
import { formatDate } from '../format-date';

describe('formatDate', () => {
  it('formats an ISO string as a localized datetime by default', () => {
    const out = formatDate('2026-08-01T10:00:00Z');
    expect(out).toMatch(/8\/1\/2026|2026/); // locale-dependent but the year is fixed
  });

  it('formats a Date instance', () => {
    const d = new Date('2026-08-01T10:00:00Z');
    expect(formatDate(d)).toBe(d.toLocaleString());
  });

  it('formats a number (epoch ms) when given one', () => {
    const ts = Date.parse('2026-08-01T10:00:00Z');
    expect(formatDate(ts)).toBe(new Date(ts).toLocaleString());
  });

  it('switches to date-only formatting when style="date"', () => {
    expect(formatDate('2026-08-01T10:00:00Z', 'date')).toBe(
      new Date('2026-08-01T10:00:00Z').toLocaleDateString(),
    );
  });

  it('returns "-" for null or undefined', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });

  it('returns "-" for unparseable strings', () => {
    expect(formatDate('not a date')).toBe('-');
  });
});
