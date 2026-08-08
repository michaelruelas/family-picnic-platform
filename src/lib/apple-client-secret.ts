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
 * Builds the Apple OAuth client secret (a short-lived JWT signed with the
 * Apple-issued ES256 private key). Apple requires this rather than a
 * static shared secret: see
 * https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 *
 * The token is short-lived (5 minutes) so a leaked value is only useful
 * to an attacker for that window. Apple also caps the validity at 6
 * months; we stay on the safe side because the secret is generated
 * on-demand.
 */
export async function buildAppleClientSecret(config: AppleClientSecretConfig): Promise<string> {
  const pem = config.privateKey.replace(/\\n/g, '\n');
  const key = await importPKCS8(pem, 'ES256');
  const issuedAt = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60 * 5)
    .setAudience('https://appleid.apple.com')
    .setSubject(config.clientId)
    .sign(key);
}

/**
 * Apple client secret with a 60-second buffer so that a request issued
 * near the end of the cache window still produces a valid JWT.
 */
const SECRET_BUFFER_MS = 60_000;
const SECRET_VALIDITY_MS = 5 * 60_000 - SECRET_BUFFER_MS;

let cachedSecret: { value: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

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
        expiresAt: Date.now() + SECRET_VALIDITY_MS,
      };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
