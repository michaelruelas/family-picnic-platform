import { prisma } from '~/lib/prisma';

export function isFirstLogin(user: {
  createdAt: Date;
  onboardingCompletedAt: Date | null;
}): boolean {
  return user.onboardingCompletedAt === null;
}

export async function completeOnboarding(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() },
  });
}

export function needsOnboarding(
  user: { createdAt: Date; onboardingCompletedAt: Date | null } | null,
): boolean {
  if (!user) return false;
  return isFirstLogin(user);
}
