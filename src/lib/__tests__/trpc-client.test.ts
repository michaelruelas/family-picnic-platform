import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalVercel = process.env.VERCEL_URL;
  const originalPort = process.env.PORT;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
    if (originalVercel === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = originalVercel;
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
  });

  it('returns empty string on browser (window defined)', async () => {
    (globalThis as { window?: unknown }).window = {};
    const { getBaseUrl } = await import('../trpc-client');
    const result = getBaseUrl();
    expect(result).toBe('');
  });

  it('returns https://${VERCEL_URL} on server when VERCEL_URL is set', async () => {
    delete (globalThis as { window?: unknown }).window;
    process.env.VERCEL_URL = 'my-deploy.vercel.app';
    delete process.env.PORT;
    const { getBaseUrl } = await import('../trpc-client');
    expect(getBaseUrl()).toBe('https://my-deploy.vercel.app');
  });

  it('returns http://localhost:${PORT} when PORT is set', async () => {
    delete (globalThis as { window?: unknown }).window;
    delete process.env.VERCEL_URL;
    process.env.PORT = '4321';
    const { getBaseUrl } = await import('../trpc-client');
    expect(getBaseUrl()).toBe('http://localhost:4321');
  });

  it('falls back to port 3000 when neither VERCEL_URL nor PORT is set', async () => {
    delete (globalThis as { window?: unknown }).window;
    delete process.env.VERCEL_URL;
    delete process.env.PORT;
    const { getBaseUrl } = await import('../trpc-client');
    expect(getBaseUrl()).toBe('http://localhost:3000');
  });
});

describe('createTRPCClient', () => {
  it('returns a tRPC client instance', async () => {
    const { createTRPCClient } = await import('../trpc-client');
    const client = createTRPCClient();
    expect(client).toBeDefined();
  });
});
