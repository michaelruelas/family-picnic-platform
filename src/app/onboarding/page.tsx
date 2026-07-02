import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { redirect } from 'next/navigation';
import OnboardingClient from '~/components/onboarding/OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      householdId: true,
      onboardingCompletedAt: true,
      household: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  if (user.onboardingCompletedAt) {
    redirect('/profile');
  }

  const households = await prisma.household.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: {
        select: { users: true, dependents: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <span className="text-3xl">🎉</span>
        </div>
        <h1 className="text-3xl font-bold text-stone-900">Welcome to Family Picnic!</h1>
        <p className="mt-2 text-lg text-stone-600">
          Let&apos;s get you set up in just a few quick steps
        </p>
      </div>

      <OnboardingClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          hasHousehold: !!user.household,
        }}
        households={households.map((h) => ({
          id: h.id,
          name: h.name,
          memberCount: h._count.users + h._count.dependents,
        }))}
      />
    </main>
  );
}
