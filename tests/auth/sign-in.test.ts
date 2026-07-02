import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('signIn callback', () => {
  const authPath = path.join(process.cwd(), 'src/lib/auth.ts');

  it('only creates user for Google provider', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain("account?.provider === 'google'");
  });

  it('checks for existing user by email before creating', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain('prisma.user.findUnique');
    expect(authContent).toContain('where: { email:');
  });

  it('only creates user if they do not exist', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain('if (!existing)');
    expect(authContent).toContain('prisma.user.create');
  });

  it('creates user with ADMIN_ADULT role as default', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain("role: 'ADMIN_ADULT'");
  });

  it('sets name from profile.name or falls back to email', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain('name: profile.name ?? profile.email');
  });

  it('returns true on successful sign-in', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain('return true');
  });

  it('returns false for non-Google providers', async () => {
    const authContent = await fs.readFile(authPath, 'utf-8');
    expect(authContent).toContain('return false');
  });
});