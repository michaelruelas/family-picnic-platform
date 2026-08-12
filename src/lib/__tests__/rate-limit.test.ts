import { describe, it, expect, beforeEach } from 'vitest';
import {
  PDF_DOWNLOADS_PER_MINUTE,
  checkInMemoryIpRateLimit,
  resetInMemoryRateLimits,
} from '../rate-limit';

describe('checkInMemoryIpRateLimit', () => {
  beforeEach(() => {
    resetInMemoryRateLimits();
  });

  it('allows requests up to the cap', () => {
    const now = Date.now();
    for (let i = 0; i < PDF_DOWNLOADS_PER_MINUTE; i += 1) {
      const result = checkInMemoryIpRateLimit('1.2.3.4', PDF_DOWNLOADS_PER_MINUTE, 60_000, now);
      expect(result.allowed).toBe(true);
    }
  });

  it('rejects the request that exceeds the cap', () => {
    const now = Date.now();
    for (let i = 0; i < PDF_DOWNLOADS_PER_MINUTE; i += 1) {
      checkInMemoryIpRateLimit('1.2.3.4', PDF_DOWNLOADS_PER_MINUTE, 60_000, now);
    }
    const blocked = checkInMemoryIpRateLimit('1.2.3.4', PDF_DOWNLOADS_PER_MINUTE, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(0);
  });

  it('isolates buckets per IP', () => {
    const now = Date.now();
    for (let i = 0; i < PDF_DOWNLOADS_PER_MINUTE; i += 1) {
      checkInMemoryIpRateLimit('1.2.3.4', PDF_DOWNLOADS_PER_MINUTE, 60_000, now);
    }
    const otherIp = checkInMemoryIpRateLimit('5.6.7.8', PDF_DOWNLOADS_PER_MINUTE, 60_000, now);
    expect(otherIp.allowed).toBe(true);
  });

  it('drops timestamps outside the window', () => {
    const start = Date.now();
    for (let i = 0; i < PDF_DOWNLOADS_PER_MINUTE; i += 1) {
      checkInMemoryIpRateLimit('1.2.3.4', PDF_DOWNLOADS_PER_MINUTE, 60_000, start);
    }
    const afterWindow = checkInMemoryIpRateLimit(
      '1.2.3.4',
      PDF_DOWNLOADS_PER_MINUTE,
      60_000,
      start + 61_000,
    );
    expect(afterWindow.allowed).toBe(true);
  });

  it('collapses a null bucket key to a shared anonymous bucket', () => {
    const now = Date.now();
    const r1 = checkInMemoryIpRateLimit(null, 2, 60_000, now);
    const r2 = checkInMemoryIpRateLimit(null, 2, 60_000, now);
    const r3 = checkInMemoryIpRateLimit(null, 2, 60_000, now);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
  });
});
