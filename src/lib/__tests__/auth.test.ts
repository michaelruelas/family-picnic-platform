import { describe, it, expect } from 'vitest';

describe('Auth module', () => {
  it('exports authOptions and getServerSession', async () => {
    const mod = await import('../auth');
    expect(mod.authOptions).toBeDefined();
    expect(typeof mod.getServerSession).toBe('function');
  });

  it('authOptions has Google provider configured', async () => {
    const { authOptions } = await import('../auth');
    const googleProvider = authOptions.providers.find((p) => p.id === 'google');
    expect(googleProvider).toBeDefined();
    expect(googleProvider).toMatchObject({
      id: 'google',
      name: 'Google',
    });
  });

  it('authOptions has session and signIn callbacks defined', async () => {
    const { authOptions } = await import('../auth');
    expect(typeof authOptions.callbacks?.session).toBe('function');
    expect(typeof authOptions.callbacks?.signIn).toBe('function');
  });
});
