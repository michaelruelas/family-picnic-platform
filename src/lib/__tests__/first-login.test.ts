import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('~/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

describe('isFirstLogin', () => {
  it('returns true when onboardingCompletedAt is null', async () => {
    const { isFirstLogin } = await import('../first-login');
    const user = { createdAt: new Date(), onboardingCompletedAt: null };
    expect(isFirstLogin(user)).toBe(true);
  });

  it('returns false when onboardingCompletedAt is set', async () => {
    const { isFirstLogin } = await import('../first-login');
    const user = { createdAt: new Date(), onboardingCompletedAt: new Date('2024-01-01') };
    expect(isFirstLogin(user)).toBe(false);
  });
});

describe('needsOnboarding', () => {
  it('returns false when user is null', async () => {
    const { needsOnboarding } = await import('../first-login');
    expect(needsOnboarding(null)).toBe(false);
  });

  it('returns true when user has not completed onboarding', async () => {
    const { needsOnboarding } = await import('../first-login');
    const user = { createdAt: new Date(), onboardingCompletedAt: null };
    expect(needsOnboarding(user)).toBe(true);
  });

  it('returns false when user has completed onboarding', async () => {
    const { needsOnboarding } = await import('../first-login');
    const user = { createdAt: new Date(), onboardingCompletedAt: new Date('2024-06-15') };
    expect(needsOnboarding(user)).toBe(false);
  });
});

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.user.update with the correct userId and date', async () => {
    const { completeOnboarding } = await import('../first-login');
    const { prisma } = await import('~/lib/prisma');

    const before = Date.now();
    await completeOnboarding('user-123');
    const after = Date.now();

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: expect.objectContaining({
        onboardingCompletedAt: expect.any(Date),
      }),
    });

    const callArg = (prisma.user.update as any).mock.calls[0][0];
    const dateValue = callArg.data.onboardingCompletedAt.getTime();
    expect(dateValue).toBeGreaterThanOrEqual(before);
    expect(dateValue).toBeLessThanOrEqual(after + 100);
  });
});
