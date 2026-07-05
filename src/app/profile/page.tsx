import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { redirect } from 'next/navigation';
import ProfileClient from '~/components/ProfileClient';
import { ThemeToggle } from '~/components/ui/ThemeToggle';
import { BreatheSection } from '~/components/ui/BreatheSection';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
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
      communicationPreference: true,
      createdAt: true,
      household: {
        select: {
          id: true,
          name: true,
        },
      },
      managedDependents: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 md:py-20">
      <BreatheSection>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Settings</p>
        <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
          My Profile
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-lg">
          Manage your account settings and how the app feels.
        </p>
      </BreatheSection>

      <BreatheSection className="mt-12">
        <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
          <ProfileClient user={user} initialDependents={user.managedDependents} />
        </div>
      </BreatheSection>

      <BreatheSection className="mt-8">
        <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
          <div className="flex items-start gap-4">
            <div className="bg-sunlight/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl">
              🎨
            </div>
            <div className="flex-1">
              <h2 className="font-display text-foreground text-2xl font-semibold">Appearance</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Choose how the picnic looks. We&apos;ll remember on this device.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <ThemeToggle />
          </div>
        </div>
      </BreatheSection>

      <BreatheSection className="mt-8">
        <div className="bg-secondary rounded-3xl p-7">
          <h2 className="font-display text-foreground text-xl font-semibold">Account Info</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="text-foreground font-medium">
                {user.createdAt.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="text-foreground font-medium capitalize">
                {session.user.role?.replace('_', ' ').toLowerCase() || 'Member'}
              </dd>
            </div>
          </dl>
        </div>
      </BreatheSection>
    </main>
  );
}
