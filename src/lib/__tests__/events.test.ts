import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();

vi.mock('~/lib/prisma', () => ({
  prisma: {
    event: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const { getLatestEvent, shouldRedirectToLatestEvent, buildEventInvitationUrl } =
  await import('../events');

describe('events helper library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLatestEvent', () => {
    it('returns upcoming published event when present', async () => {
      const upcoming = {
        id: 'evt-upcoming',
        name: 'Upcoming Picnic',
        date: new Date('2026-09-01'),
      };
      mockFindFirst.mockResolvedValueOnce(upcoming);

      const result = await getLatestEvent();
      expect(result).toEqual(upcoming);
      expect(mockFindFirst).toHaveBeenCalledTimes(1);
    });

    it('falls back to past published event when no upcoming event', async () => {
      const past = { id: 'evt-past', name: 'Past Picnic', date: new Date('2025-09-01') };
      mockFindFirst.mockResolvedValueOnce(null); // upcoming
      mockFindFirst.mockResolvedValueOnce(past); // past

      const result = await getLatestEvent();
      expect(result).toEqual(past);
      expect(mockFindFirst).toHaveBeenCalledTimes(2);
    });

    it('falls back to any event when no published events exist', async () => {
      const draft = { id: 'evt-draft', name: 'Draft Picnic', date: new Date('2026-10-01') };
      mockFindFirst.mockResolvedValueOnce(null); // upcoming
      mockFindFirst.mockResolvedValueOnce(null); // past
      mockFindFirst.mockResolvedValueOnce(draft); // any

      const result = await getLatestEvent();
      expect(result).toEqual(draft);
      expect(mockFindFirst).toHaveBeenCalledTimes(3);
    });

    it('returns null when no events exist in database', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      mockFindFirst.mockResolvedValueOnce(null);
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await getLatestEvent();
      expect(result).toBeNull();
    });
  });

  describe('shouldRedirectToLatestEvent', () => {
    const originalEnv = process.env.REDIRECT_EVENTS_TO_LATEST;

    beforeEach(() => {
      delete process.env.REDIRECT_EVENTS_TO_LATEST;
    });

    it('defaults to true when env var is not set', () => {
      expect(shouldRedirectToLatestEvent()).toBe(true);
    });

    it('returns true when env var is true', () => {
      process.env.REDIRECT_EVENTS_TO_LATEST = 'true';
      expect(shouldRedirectToLatestEvent()).toBe(true);
    });

    it('returns false when env var is false', () => {
      process.env.REDIRECT_EVENTS_TO_LATEST = 'false';
      expect(shouldRedirectToLatestEvent()).toBe(false);
      process.env.REDIRECT_EVENTS_TO_LATEST = originalEnv;
    });
  });

  describe('buildEventInvitationUrl', () => {
    it('constructs /events/[id]/rsvp using NEXTAUTH_URL or default', () => {
      const url = buildEventInvitationUrl('evt-123', 'https://picnic.example.com');
      expect(url).toBe('https://picnic.example.com/events/evt-123/rsvp');
    });

    it('handles trailing slash on base url', () => {
      const url = buildEventInvitationUrl('evt-123', 'https://picnic.example.com/');
      expect(url).toBe('https://picnic.example.com/events/evt-123/rsvp');
    });
  });
});
