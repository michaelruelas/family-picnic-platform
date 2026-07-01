import { describe, it, expect } from 'vitest';

describe('Prisma client module', () => {
  it('exports a prisma singleton', async () => {
    const { prisma } = await import('../prisma');
    expect(prisma).toBeDefined();
    expect(prisma.$connect).toBeInstanceOf(Function);
  });

  it('reuses the same instance in development (global caching)', async () => {
    const { prisma: prismaA } = await import('../prisma');
    const { prisma: prismaB } = await import('../prisma');
    expect(prismaA).toBe(prismaB);
  });
});
