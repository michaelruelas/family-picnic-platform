import { describe, it, expect } from 'vitest';

describe('trpc-client module exports', () => {
  it('exports trpc object (callable function)', async () => {
    const mod = await import('../trpc-client');
    expect(mod.trpc).toBeDefined();
    expect(typeof mod.trpc).toBe('function');
  });

  it('exports getBaseUrl function', async () => {
    const mod = await import('../trpc-client');
    expect(mod.getBaseUrl).toBeDefined();
    expect(typeof mod.getBaseUrl).toBe('function');
  });

  it('exports createTRPCClient function', async () => {
    const mod = await import('../trpc-client');
    expect(mod.createTRPCClient).toBeDefined();
    expect(typeof mod.createTRPCClient).toBe('function');
  });

  it('exports exactly trpc, getBaseUrl, and createTRPCClient', async () => {
    const mod = await import('../trpc-client');
    const keys = Object.keys(mod).sort();
    expect(keys).toEqual(['createTRPCClient', 'getBaseUrl', 'trpc']);
  });
});

describe('getBaseUrl', () => {
  it('returns empty string on browser (window defined)', async () => {
    const { getBaseUrl } = await import('../trpc-client');
    const result = getBaseUrl();
    expect(result).toBe('');
  });
});
