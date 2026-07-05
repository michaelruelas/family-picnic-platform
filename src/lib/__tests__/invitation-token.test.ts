import { describe, it, expect } from 'vitest';

describe('invitation-token', () => {
  describe('generateInvitationToken', () => {
    it('returns a string matching HEX-HEX format', async () => {
      const { generateInvitationToken } = await import('../invitation-token');
      const token = generateInvitationToken();
      expect(token).toMatch(/^[0-9A-F]+-[0-9A-F]+$/);
    });

    it('produces unique tokens on successive calls', async () => {
      const { generateInvitationToken } = await import('../invitation-token');
      const token1 = generateInvitationToken();
      const token2 = generateInvitationToken();
      expect(token1).not.toBe(token2);
    });

    it('returns tokens in uppercase', async () => {
      const { generateInvitationToken } = await import('../invitation-token');
      const token = generateInvitationToken();
      expect(token).toBe(token.toUpperCase());
    });

    it('has a timestamp part and a random part separated by dash', async () => {
      const { generateInvitationToken } = await import('../invitation-token');
      const token = generateInvitationToken();
      const parts = token.split('-');
      expect(parts).toHaveLength(2);
      expect(parts[0]!.length).toBeGreaterThanOrEqual(8);
      expect(parts[1]!.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('getInvitationExpiry', () => {
    it('returns a Date object', async () => {
      const { getInvitationExpiry } = await import('../invitation-token');
      const result = getInvitationExpiry();
      expect(result).toBeInstanceOf(Date);
    });

    it('with default 30 days, returns date approximately 30 days in future', async () => {
      const { getInvitationExpiry } = await import('../invitation-token');
      const before = Date.now();
      const result = getInvitationExpiry();
      const after = Date.now();
      const expectedMin = before + 30 * 24 * 60 * 60 * 1000;
      const expectedMax = after + 30 * 24 * 60 * 60 * 1000;
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin - 100);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMax + 100);
    });

    it('with custom 7 days, returns date approximately 7 days in future', async () => {
      const { getInvitationExpiry } = await import('../invitation-token');
      const before = Date.now();
      const result = getInvitationExpiry(7);
      const after = Date.now();
      const expectedMin = before + 7 * 24 * 60 * 60 * 1000;
      const expectedMax = after + 7 * 24 * 60 * 60 * 1000;
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin - 100);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMax + 100);
    });

    it('with 0 days, returns date approximately now', async () => {
      const { getInvitationExpiry } = await import('../invitation-token');
      const before = Date.now();
      const result = getInvitationExpiry(0);
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('with 365 days, returns date approximately 1 year in future', async () => {
      const { getInvitationExpiry } = await import('../invitation-token');
      const before = Date.now();
      const result = getInvitationExpiry(365);
      const after = Date.now();
      const expectedMin = before + 365 * 24 * 60 * 60 * 1000;
      const expectedMax = after + 365 * 24 * 60 * 60 * 1000;
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin - 100);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMax + 100);
    });
  });
});
