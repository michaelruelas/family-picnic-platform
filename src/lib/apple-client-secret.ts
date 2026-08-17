import { SignJWT, importPKCS8 } from 'jose';

export interface AppleClientSecretConfig {
  teamId: string;
  clientId: string;
  keyId: string;
  /**
   * The PEM private key from the .p8 file. Newlines may be escaped as `\n`
   * to keep this value single-line in env files.
   */
  privateKey: string;
}

export interface AppleClientSecretInputs {
  teamId?: string;
  clientId?: string;
  keyId?: string;
  privateKey?: string;
}

/**
 * Reads the Apple OAuth env vars and returns null when any is missing.
 * The check is permissive — empty strings are treated as missing.
 */
export function readAppleClientSecretConfig(): AppleClientSecretConfig | null {
  const teamId = process.env.AUTH_APPLE_TEAM_ID;
  const clientId = process.env.AUTH_APPLE_ID;
  const keyId = process.env.AUTH_APPLE_KEY_ID;
  const privateKey = process.env.AUTH_APPLE_PRIVATE_KEY;
  if (!teamId || !clientId || !keyId || !privateKey) {
    return null;
  }
  return { teamId, clientId, keyId, privateKey };
}

/**
 * Cleans up and normalizes a PEM-encoded ES256 private key string.
 * Handles escaped newlines, Windows line endings, surrounding quotes,
 * and missing PKCS#8 header/footer delimiters.
 */
export function formatApplePrivateKey(rawKey: string): string {
  let cleaned = rawKey.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\\r\\n|\\n/g, '\n').replace(/\r\n/g, '\n');
  if (!cleaned.includes('-----BEGIN PRIVATE KEY-----')) {
    cleaned = `-----BEGIN PRIVATE KEY-----\n${cleaned}\n-----END PRIVATE KEY-----`;
  }
  return cleaned;
}

/**
 * Default validity period for the Apple client secret JWT.
 * 1 hour (3600 seconds) gives a secure, standard window for OAuth
 * client assertion JWTs while avoiding short expiration race conditions.
 */
export const DEFAULT_APPLE_SECRET_EXPIRATION_SECONDS = 60 * 60; // 1 hour

/**
 * Builds the Apple OAuth client secret (a JWT signed with the
 * Apple-issued ES256 private key). Apple requires this rather than a
 * static shared secret: see
 * https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 */
export async function buildAppleClientSecret(
  config: AppleClientSecretConfig,
  expiresInSeconds: number = DEFAULT_APPLE_SECRET_EXPIRATION_SECONDS,
): Promise<string> {
  const pem = formatApplePrivateKey(config.privateKey);
  const key = await importPKCS8(pem, 'ES256');
  const issuedAt = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + expiresInSeconds)
    .setAudience('https://appleid.apple.com')
    .setSubject(config.clientId)
    .sign(key);
}

/**
 * Cache TTL for the in-memory client secret.
 * Refreshes 10 minutes before the 1-hour expiration window.
 */
const SECRET_CACHE_TTL_MS = 50 * 60 * 1000;

let cachedSecret: { value: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

export function resetAppleClientSecretCache(): void {
  cachedSecret = null;
  inflight = null;
}

/**
 * Returns the currently cached Apple client secret JWT synchronously,
 * or null if uninitialized or expired.
 */
export function getAppleClientSecretCached(): string | null {
  if (cachedSecret && cachedSecret.expiresAt > Date.now()) {
    return cachedSecret.value;
  }
  return null;
}

export async function getAppleClientSecret(): Promise<string> {
  const config = readAppleClientSecretConfig();
  if (!config) {
    throw new Error(
      'Apple OAuth is not configured. Set AUTH_APPLE_TEAM_ID, AUTH_APPLE_ID, AUTH_APPLE_KEY_ID, and AUTH_APPLE_PRIVATE_KEY.',
    );
  }
  if (cachedSecret && cachedSecret.expiresAt > Date.now()) {
    return cachedSecret.value;
  }
  if (inflight) return inflight;
  inflight = buildAppleClientSecret(config)
    .then((value) => {
      cachedSecret = {
        value,
        expiresAt: Date.now() + SECRET_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
