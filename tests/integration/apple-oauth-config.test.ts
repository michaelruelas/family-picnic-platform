import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('OAuth and Google Maps wiring (deployment and config)', () => {
  const nextjsPath = path.join(process.cwd(), 'kubernetes/base/nextjs.yaml');
  const externalSecretsPath = path.join(
    process.cwd(),
    'kubernetes/overlays/pugquilt-dev/external-secrets.yaml',
  );
  const populateScriptPath = path.join(process.cwd(), 'scripts/populate-openbao-secrets.sh');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const appleSecretLibPath = path.join(process.cwd(), 'src/lib/apple-client-secret.ts');
  const googleMapsLibPath = path.join(process.cwd(), 'src/lib/google-maps.ts');
  const authLibPath = path.join(process.cwd(), 'src/lib/auth.ts');

  it('nextjs deployment reads Apple, Facebook, and Google Maps secrets', async () => {
    const content = await fs.readFile(nextjsPath, 'utf-8');
    expect(content).toContain('AUTH_APPLE_ID');
    expect(content).toContain('key: auth-apple-id');
    expect(content).toContain('AUTH_APPLE_TEAM_ID');
    expect(content).toContain('key: auth-apple-team-id');
    expect(content).toContain('AUTH_APPLE_KEY_ID');
    expect(content).toContain('key: auth-apple-key-id');
    expect(content).toContain('AUTH_APPLE_PRIVATE_KEY');
    expect(content).toContain('key: auth-apple-private-key');
    expect(content).toContain('AUTH_FACEBOOK_ID');
    expect(content).toContain('key: auth-facebook-id');
    expect(content).toContain('AUTH_FACEBOOK_SECRET');
    expect(content).toContain('key: auth-facebook-secret');
    expect(content).toContain('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
    expect(content).toContain('key: google-maps-api-key');
  });

  it('ExternalSecret declares Apple, Facebook, and Google Maps keys bound from OpenBao', async () => {
    const content = await fs.readFile(externalSecretsPath, 'utf-8');
    for (const key of [
      'auth-apple-id',
      'auth-apple-team-id',
      'auth-apple-key-id',
      'auth-apple-private-key',
      'auth-facebook-id',
      'auth-facebook-secret',
      'google-maps-api-key',
    ]) {
      expect(content).toContain(`secretKey: ${key}`);
      expect(content).toContain(`property: ${key}`);
    }
  });

  it('populate-openbao-secrets.sh round-trips Apple, Facebook, and Google Maps keys', async () => {
    const content = await fs.readFile(populateScriptPath, 'utf-8');
    for (const key of [
      'AUTH_APPLE_ID',
      'AUTH_APPLE_TEAM_ID',
      'AUTH_APPLE_KEY_ID',
      'AUTH_APPLE_PRIVATE_KEY',
      'AUTH_FACEBOOK_ID',
      'AUTH_FACEBOOK_SECRET',
      'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
    ]) {
      expect(content).toMatch(new RegExp(`${key}=\\$\\(resolve`));
      expect(content).toMatch(new RegExp(`env_dev_get ${key}`));
    }
    expect(content).toContain('auth-apple-id="$AUTH_APPLE_ID"');
    expect(content).toContain('auth-apple-team-id="$AUTH_APPLE_TEAM_ID"');
    expect(content).toContain('auth-apple-key-id="$AUTH_APPLE_KEY_ID"');
    expect(content).toContain('auth-apple-private-key="$AUTH_APPLE_PRIVATE_KEY"');
    expect(content).toContain('auth-facebook-id="$AUTH_FACEBOOK_ID"');
    expect(content).toContain('auth-facebook-secret="$AUTH_FACEBOOK_SECRET"');
    expect(content).toContain('google-maps-api-key="$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"');
  });

  it('.env.example documents Apple, Facebook, and Google Maps keys', async () => {
    const content = await fs.readFile(envExamplePath, 'utf-8');
    expect(content).toContain('AUTH_APPLE_ID=""');
    expect(content).toContain('AUTH_APPLE_TEAM_ID=""');
    expect(content).toContain('AUTH_APPLE_KEY_ID=""');
    expect(content).toContain('AUTH_APPLE_PRIVATE_KEY=""');
    expect(content).toContain('AUTH_FACEBOOK_ID=""');
    expect(content).toContain('AUTH_FACEBOOK_SECRET=""');
    expect(content).toContain('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""');
  });

  it('apple-client-secret.ts reads Apple keys from process.env', async () => {
    const content = await fs.readFile(appleSecretLibPath, 'utf-8');
    expect(content).toContain('process.env.AUTH_APPLE_TEAM_ID');
    expect(content).toContain('process.env.AUTH_APPLE_ID');
    expect(content).toContain('process.env.AUTH_APPLE_KEY_ID');
    expect(content).toContain('process.env.AUTH_APPLE_PRIVATE_KEY');
  });

  it('auth.ts reads Facebook keys from process.env', async () => {
    const content = await fs.readFile(authLibPath, 'utf-8');
    expect(content).toContain('process.env.AUTH_FACEBOOK_ID');
    expect(content).toContain('process.env.AUTH_FACEBOOK_SECRET');
  });

  it('google-maps.ts reads Google Maps API key from process.env', async () => {
    const content = await fs.readFile(googleMapsLibPath, 'utf-8');
    expect(content).toContain('process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  });

  it('populate-openbao-secrets.sh supports --export-patch mode', async () => {
    const content = await fs.readFile(populateScriptPath, 'utf-8');
    expect(content).toContain('--export-patch');
    expect(content).toContain('EXPORT_PATCH');
    expect(content).toContain('bao kv patch');
  });
});
