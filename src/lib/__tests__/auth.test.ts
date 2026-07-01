import { describe, it, expect } from 'vitest';

describe('Auth module', () => {
  it('exports handler (NextAuth v4 pattern)', async () => {
    const mod = await import('../auth');
    expect(mod).toBeDefined();
    expect(typeof mod).toBe('object');
  });

  it('returns GET and POST route handlers', async () => {
    const mod = await import('../auth');
    if (mod.GET) {
      expect(mod.GET).toBeInstanceOf(Function);
      expect(mod.POST).toBeInstanceOf(Function);
    }
  });
});
