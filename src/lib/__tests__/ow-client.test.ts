import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock must run before any import that pulls in the real
// `openworkflow` modules. Hoist the shared mock instance so the
// factory below can reach it during vitest's hoisted mock phase.
const mockOwInstance = vi.hoisted(() => ({ _mock: true }));

vi.mock('openworkflow', () => ({
  OpenWorkflow: vi.fn(function () {
    return mockOwInstance;
  }),
}));
vi.mock('openworkflow/postgres', () => ({
  BackendPostgres: {
    connect: vi.fn().mockResolvedValue({ _mock: true }),
  },
}));

beforeEach(() => {
  vi.resetModules();
  delete process.env.DATABASE_URL;
});

describe('getOpenWorkflow', () => {
  it('throws error when DATABASE_URL is not set', async () => {
    const { getOpenWorkflow } = await import('~/lib/ow-client');
    await expect(getOpenWorkflow()).rejects.toThrow('DATABASE_URL is required');
  });

  it('returns same instance on second call (singleton)', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

    const { getOpenWorkflow } = await import('~/lib/ow-client');
    const instance1 = await getOpenWorkflow();
    const instance2 = await getOpenWorkflow();
    expect(instance1).toBe(instance2);
  });
});
