// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPair, exportPKCS8, jwtVerify, importSPKI, exportSPKI } from 'jose';
import {
  readAppleClientSecretConfig,
  buildAppleClientSecret,
  getAppleClientSecret,
  formatApplePrivateKey,
  resetAppleClientSecretCache,
  DEFAULT_APPLE_SECRET_EXPIRATION_SECONDS,
} from '../apple-client-secret';

describe('formatApplePrivateKey', () => {
  it('handles standard PEM format with real newlines', () => {
    const raw = `-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----`;
    const formatted = formatApplePrivateKey(raw);
    expect(formatted).toBe(raw);
  });

  it('strips surrounding double and single quotes', () => {
    const rawDouble = `"-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----"`;
    const rawSingle = `'-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----'`;
    expect(formatApplePrivateKey(rawDouble).startsWith('"')).toBe(false);
    expect(formatApplePrivateKey(rawDouble).endsWith('"')).toBe(false);
    expect(formatApplePrivateKey(rawSingle).startsWith("'")).toBe(false);
    expect(formatApplePrivateKey(rawSingle).endsWith("'")).toBe(false);
  });

  it('replaces escaped \\n with actual newlines', () => {
    const raw = '-----BEGIN PRIVATE KEY-----\\nline1\\nline2\\n-----END PRIVATE KEY-----';
    const formatted = formatApplePrivateKey(raw);
    expect(formatted).toBe('-----BEGIN PRIVATE KEY-----\nline1\nline2\n-----END PRIVATE KEY-----');
  });

  it('adds PEM header and footer if missing', () => {
    const raw = 'MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg';
    const formatted = formatApplePrivateKey(raw);
    expect(formatted).toBe(
      `-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----`,
    );
  });
});

describe('readAppleClientSecretConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when any required variable is missing', () => {
    expect(readAppleClientSecretConfig()).toBeNull();

    vi.stubEnv('AUTH_APPLE_TEAM_ID', 'TEAM123456');
    expect(readAppleClientSecretConfig()).toBeNull();

    vi.stubEnv('AUTH_APPLE_ID', 'com.example.service');
    expect(readAppleClientSecretConfig()).toBeNull();

    vi.stubEnv('AUTH_APPLE_KEY_ID', 'KEY1234567');
    expect(readAppleClientSecretConfig()).toBeNull();
  });

  it('returns null when any variable is empty string', () => {
    vi.stubEnv('AUTH_APPLE_TEAM_ID', 'TEAM123456');
    vi.stubEnv('AUTH_APPLE_ID', 'com.example.service');
    vi.stubEnv('AUTH_APPLE_KEY_ID', 'KEY1234567');
    vi.stubEnv('AUTH_APPLE_PRIVATE_KEY', '');
    expect(readAppleClientSecretConfig()).toBeNull();
  });

  it('returns config object when all 4 variables are present', () => {
    vi.stubEnv('AUTH_APPLE_TEAM_ID', 'TEAM123456');
    vi.stubEnv('AUTH_APPLE_ID', 'com.example.service');
    vi.stubEnv('AUTH_APPLE_KEY_ID', 'KEY1234567');
    vi.stubEnv('AUTH_APPLE_PRIVATE_KEY', 'my-key');

    const config = readAppleClientSecretConfig();
    expect(config).toEqual({
      teamId: 'TEAM123456',
      clientId: 'com.example.service',
      keyId: 'KEY1234567',
      privateKey: 'my-key',
    });
  });
});

describe('buildAppleClientSecret and getAppleClientSecret', () => {
  let testPrivateKeyPem: string;
  let testPublicKeyPem: string;

  beforeEach(async () => {
    resetAppleClientSecretCache();
    vi.unstubAllEnvs();

    // Generate a valid ES256 key pair for tests
    const keyPair = await generateKeyPair('ES256', { extractable: true });
    testPrivateKeyPem = await exportPKCS8(keyPair.privateKey);
    testPublicKeyPem = await exportSPKI(keyPair.publicKey);
  });

  it('generates a valid signed JWT with 1-hour expiration and correct claims', async () => {
    const config = {
      teamId: 'APPLE_TEAM_10',
      clientId: 'com.foliapicnic.auth',
      keyId: 'APPLE_KEY_10',
      privateKey: testPrivateKeyPem,
    };

    const beforeTime = Math.floor(Date.now() / 1000);
    const jwt = await buildAppleClientSecret(config);
    const afterTime = Math.floor(Date.now() / 1000);

    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3);

    // Verify JWT with the corresponding public key
    const publicKey = await importSPKI(testPublicKeyPem, 'ES256');
    const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, {
      issuer: 'APPLE_TEAM_10',
      audience: 'https://appleid.apple.com',
      subject: 'com.foliapicnic.auth',
    });

    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.kid).toBe('APPLE_KEY_10');
    expect(payload.iss).toBe('APPLE_TEAM_10');
    expect(payload.aud).toBe('https://appleid.apple.com');
    expect(payload.sub).toBe('com.foliapicnic.auth');
    expect(payload.iat).toBeGreaterThanOrEqual(beforeTime);
    expect(payload.iat).toBeLessThanOrEqual(afterTime);
    expect(payload.exp).toBe(payload.iat! + DEFAULT_APPLE_SECRET_EXPIRATION_SECONDS);
  });

  it('handles escaped newline private keys correctly', async () => {
    const escapedPrivateKey = testPrivateKeyPem.replace(/\n/g, '\\n');
    const config = {
      teamId: 'APPLE_TEAM_10',
      clientId: 'com.foliapicnic.auth',
      keyId: 'APPLE_KEY_10',
      privateKey: escapedPrivateKey,
    };

    const jwt = await buildAppleClientSecret(config);
    const publicKey = await importSPKI(testPublicKeyPem, 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey, {
      audience: 'https://appleid.apple.com',
    });

    expect(payload.sub).toBe('com.foliapicnic.auth');
  });

  it('supports custom expiresInSeconds', async () => {
    const config = {
      teamId: 'APPLE_TEAM_10',
      clientId: 'com.foliapicnic.auth',
      keyId: 'APPLE_KEY_10',
      privateKey: testPrivateKeyPem,
    };

    const customExpiry = 3600; // 1 hour
    const jwt = await buildAppleClientSecret(config, customExpiry);
    const publicKey = await importSPKI(testPublicKeyPem, 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey, {
      audience: 'https://appleid.apple.com',
    });

    expect(payload.exp).toBe(payload.iat! + customExpiry);
  });

  it('getAppleClientSecret throws when env is unconfigured', async () => {
    await expect(getAppleClientSecret()).rejects.toThrow('Apple OAuth is not configured');
  });

  it('getAppleClientSecret returns cached JWT on subsequent calls', async () => {
    vi.stubEnv('AUTH_APPLE_TEAM_ID', 'APPLE_TEAM_10');
    vi.stubEnv('AUTH_APPLE_ID', 'com.foliapicnic.auth');
    vi.stubEnv('AUTH_APPLE_KEY_ID', 'APPLE_KEY_10');
    vi.stubEnv('AUTH_APPLE_PRIVATE_KEY', testPrivateKeyPem);

    const token1 = await getAppleClientSecret();
    const token2 = await getAppleClientSecret();

    expect(token1).toBe(token2);
  });
});
