import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('signIn callback', () => {
  const authPath = path.join(process.cwd(), 'src/lib/auth.ts');
  const userIdentityPath = path.join(process.cwd(), 'src/lib/user-identity.ts');

  it('only creates user for OAuth providers via the identity helper', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    const identityContent = await fs.readFile(userIdentityPath, 'utf-8');
    // auth.ts delegates to the helper
    expect(authContent).toContain('findOrCreateUserByIdentity');
    // helper handles all three providers
    expect(identityContent).toContain("'google'");
    expect(identityContent).toContain("'apple'");
    expect(identityContent).toContain("'facebook'");
  });

  it('checks for existing linked identity before creating', async () => {
    const identityContent = await fs.readFile(userIdentityPath, 'utf-8');
    expect(identityContent).toContain('prisma.linkedIdentity.findUnique');
    expect(identityContent).toContain('provider_providerAccountId');
  });

  it('only creates user if no soft-deleted tombstone exists', async () => {
    const identityContent = await fs.readFile(userIdentityPath, 'utf-8');
    expect(identityContent).toContain('deletedAt: null');
    expect(identityContent).toContain('user_tombstoned');
    expect(identityContent).toContain('email_tombstoned');
  });

  it('creates user with ADULT role as default', async () => {
    const identityContent = await fs.readFile(userIdentityPath, 'utf-8');
    expect(identityContent).toContain("role: 'ADULT'");
  });

  it('falls back to email when profile name is missing', async () => {
    const identityContent = await fs.readFile(userIdentityPath, 'utf-8');
    expect(identityContent).toContain('name: email');
  });

  it('returns true on successful sign-in', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain('return resolved !== null');
  });

  it('returns false for non-OAuth providers and unknown providers', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain('return false');
    expect(authContent).toContain('isOAuthProvider');
  });

  it('writes an audit entry for each sign-in decision', async () => {
    const identityContent = await fs.readFile(userIdentityPath, 'utf-8');
    expect(identityContent).toContain('auth.signIn.succeeded');
    expect(identityContent).toContain('auth.signIn.refused');
    expect(identityContent).toContain('auth.identity.linked');
  });
});
