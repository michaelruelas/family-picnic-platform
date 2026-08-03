import { describe, it, expect } from 'vitest';
import { extractClientIp, parseTrustedProxyIps } from '../client-ip';

function makeHeaders(map: Record<string, string>): Pick<Headers, 'get'> {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (name: string) => (lower[name.toLowerCase()] ?? null) as string | null };
}

describe('parseTrustedProxyIps', () => {
  it('returns empty for undefined, null, or empty', () => {
    expect(parseTrustedProxyIps(undefined)).toEqual([]);
    expect(parseTrustedProxyIps(null)).toEqual([]);
    expect(parseTrustedProxyIps('')).toEqual([]);
  });

  it('splits, trims, and drops empties', () => {
    expect(parseTrustedProxyIps('10.0.0.1, 10.0.0.2 ,,10.0.0.3')).toEqual([
      '10.0.0.1',
      '10.0.0.2',
      '10.0.0.3',
    ]);
  });
});

describe('extractClientIp', () => {
  const headers = (map: Record<string, string>) => makeHeaders(map);

  it('returns null when allowlist is empty (safe default)', () => {
    expect(extractClientIp(headers({ 'x-forwarded-for': '203.0.113.5' })).ip).toBeNull();
    expect(extractClientIp(headers({ 'x-real-ip': '203.0.113.5' })).ip).toBeNull();
  });

  it('returns null when allowlist is empty and no headers present', () => {
    expect(extractClientIp(headers({})).ip).toBeNull();
  });

  it('returns the rightmost-untrusted IP from x-forwarded-for', () => {
    const h = headers({
      'x-forwarded-for': '203.0.113.5, 10.0.0.2, 10.0.0.1',
    });
    expect(extractClientIp(h, ['10.0.0.1', '10.0.0.2']).ip).toBe('203.0.113.5');
  });

  it('skips multiple trusted proxies in the chain', () => {
    const h = headers({
      'x-forwarded-for': '198.51.100.7, 10.0.0.3, 10.0.0.2, 10.0.0.1',
    });
    expect(extractClientIp(h, ['10.0.0.1', '10.0.0.2', '10.0.0.3']).ip).toBe('198.51.100.7');
  });

  it('falls back to x-real-ip when allowlist is non-empty and x-forwarded-for has only trusted entries', () => {
    const h = headers({
      'x-forwarded-for': '10.0.0.2, 10.0.0.1',
      'x-real-ip': '203.0.113.5',
    });
    expect(extractClientIp(h, ['10.0.0.1', '10.0.0.2']).ip).toBe('203.0.113.5');
  });

  it('returns null when every entry is in the allowlist (no client IP can be trusted)', () => {
    const h = headers({
      'x-forwarded-for': '10.0.0.1',
    });
    expect(extractClientIp(h, ['10.0.0.1']).ip).toBeNull();
  });

  it('returns null when only trusted entries appear and x-real-ip is missing', () => {
    const h = headers({
      'x-forwarded-for': '10.0.0.2, 10.0.0.1',
    });
    expect(extractClientIp(h, ['10.0.0.1', '10.0.0.2']).ip).toBeNull();
  });

  it('treats headers case-insensitively', () => {
    const h = headers({ 'X-Forwarded-For': '203.0.113.5, 10.0.0.1' });
    expect(extractClientIp(h, ['10.0.0.1']).ip).toBe('203.0.113.5');
  });
});
