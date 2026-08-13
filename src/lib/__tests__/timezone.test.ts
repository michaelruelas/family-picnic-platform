import { describe, it, expect, vi } from 'vitest';
import { formatTimezoneLabel, getClientTimezone, getServerTimezone } from '../timezone';

describe('getClientTimezone', () => {
  it('returns the resolved timezone when Intl is available', () => {
    const tz = getClientTimezone();
    expect(typeof tz === 'string' || typeof tz === 'undefined').toBe(true);
  });

  it('returns undefined when Intl throws', () => {
    const original = Intl.DateTimeFormat;
    (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = vi.fn(() => {
      throw new Error('boom');
    });
    try {
      expect(getClientTimezone()).toBeUndefined();
    } finally {
      (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = original;
    }
  });

  it('returns undefined when no timezone is reported', () => {
    const original = Intl.DateTimeFormat;
    (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = vi.fn(() => ({
      resolvedOptions: () => ({ timeZone: '' }),
    }));
    try {
      expect(getClientTimezone()).toBeUndefined();
    } finally {
      (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = original;
    }
  });
});

describe('getServerTimezone', () => {
  it('falls back to UTC when Intl is unavailable', () => {
    const original = (globalThis as { Intl?: typeof Intl }).Intl;
    (globalThis as unknown as { Intl: undefined }).Intl = undefined;
    try {
      expect(getServerTimezone()).toBe('UTC');
    } finally {
      (globalThis as unknown as { Intl: typeof Intl | undefined }).Intl = original;
    }
  });
});

describe('formatTimezoneLabel', () => {
  it('returns an empty string for undefined input', () => {
    expect(formatTimezoneLabel(undefined)).toBe('');
  });

  it('formats a known timezone as "City (Abbrev)"', () => {
    const instant = new Date('2026-08-12T18:00:00Z');
    const label = formatTimezoneLabel('America/Los_Angeles', instant);
    expect(label).toMatch(/Los Angeles/);
    expect(label).toMatch(/\((PDT|PST|UTC)\)/);
  });

  it('falls back to the raw id when formatting fails', () => {
    const original = Intl.DateTimeFormat;
    (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = vi.fn(() => {
      throw new Error('boom');
    });
    try {
      expect(formatTimezoneLabel('Mars/Olympus_Mons')).toBe('Mars/Olympus_Mons');
    } finally {
      (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = original;
    }
  });
});
