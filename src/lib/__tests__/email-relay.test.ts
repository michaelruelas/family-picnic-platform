import { describe, it, expect } from 'vitest';
import { isRelayEmail, RELAY_EMAIL_DOMAINS } from '../email-relay';

describe('isRelayEmail', () => {
  it('matches Apple Private Relay addresses', () => {
    expect(isRelayEmail('cty74tsk8y@privaterelay.appleid.com')).toBe(true);
    expect(isRelayEmail('abc.123@privaterelay.appleid.com')).toBe(true);
  });

  it('is case-insensitive on the domain', () => {
    expect(isRelayEmail('foo@PRIVATERELAY.APPLEID.COM')).toBe(true);
    expect(isRelayEmail('foo@PrivateRelay.AppleID.com')).toBe(true);
  });

  it('does not match look-alike domains', () => {
    expect(isRelayEmail('foo@privaterelay.com')).toBe(false);
    expect(isRelayEmail('foo@appleid.com')).toBe(false);
    expect(isRelayEmail('foo@notprivaterelay.appleid.com.evil.example')).toBe(false);
    expect(isRelayEmail('foo@privaterelay.appleid.com.evil.example')).toBe(false);
  });

  it('does not match real emails', () => {
    expect(isRelayEmail('maria.garcia@example.com')).toBe(false);
    expect(isRelayEmail('admin@family-picnic.example.com')).toBe(false);
  });

  it('returns false for null, undefined, or malformed values', () => {
    expect(isRelayEmail(null)).toBe(false);
    expect(isRelayEmail(undefined)).toBe(false);
    expect(isRelayEmail('')).toBe(false);
    expect(isRelayEmail('no-at-sign')).toBe(false);
    expect(isRelayEmail('@privaterelay.appleid.com')).toBe(true);
  });

  it('exposes a stable RELAY_EMAIL_DOMAINS list', () => {
    expect(RELAY_EMAIL_DOMAINS).toContain('privaterelay.appleid.com');
  });
});
