import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions, getEnabledOAuthProviders } from '~/lib/auth';
import { redirect } from 'next/navigation';
import ProfileClient from '~/components/ProfileClient';
import LinkedAccounts from '~/components/LinkedAccounts';
import HouseholdMembersClient from '~/components/household/HouseholdMembersClient';
import HouseholdCreateForm from '~/components/household/HouseholdCreateForm';
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
      householdId: true,
      household: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
          users: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          members: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              name: true,
              age: true,
              notes: true,
              relationship: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  const hasHousehold = user.household && user.household.deletedAt === null;
  const household = user.household;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:py-20">
      <BreatheSection>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Profile</p>
        <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
          My Profile
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-lg">
          Manage your account, household, and how the app feels.
        </p>
      </BreatheSection>

      {!hasHousehold ? (
        <BreatheSection className="mt-12">
          <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
            <div className="flex items-start gap-4">
              <div className="bg-sunlight/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-2xl">
                🏠
              </div>
              <div className="flex-1">
                <h2 className="font-display text-foreground text-2xl font-semibold">
                  No household yet
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Set one up to start adding family members and RSVPing to events.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <HouseholdCreateForm />
            </div>
          </div>
        </BreatheSection>
      ) : (
        <>
          <BreatheSection className="mt-10">
            <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
              <div className="flex items-start gap-4">
                <div className="bg-sunlight/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-2xl">
                  🏠
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-foreground text-2xl font-semibold">Household</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Your family household for RSVPs and planning.
                  </p>
                </div>
              </div>
            </div>
          </BreatheSection>

          <BreatheSection className="mt-8">
            <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
              <div className="flex items-start gap-4">
                <div className="bg-sunlight/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-2xl">
                  👥
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-foreground text-2xl font-semibold">
                    Account Holders
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">Adults with login access</p>
                </div>
              </div>

              {household!.users.length === 0 ? (
                <p className="text-muted-foreground mt-6 text-sm">No account holders yet.</p>
              ) : (
                <ul className="mt-6 space-y-3">
                  {household!.users.map((member) => (
                    <li key={member.id} className="flex items-center gap-3">
                      <div className="bg-terracotta/15 text-terracotta flex h-10 w-10 items-center justify-center rounded-sm font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-foreground font-medium">{member.name}</p>
                        <p className="text-muted-foreground text-xs">{member.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </BreatheSection>

          <BreatheSection className="mt-8">
            <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
              <HouseholdMembersClient
                householdId={household!.id}
                initialMembers={household!.members}
              />
            </div>
          </BreatheSection>
        </>
      )}

      <BreatheSection className="mt-12">
        <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
          <ProfileClient
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              communicationPreference: user.communicationPreference,
              household: hasHousehold ? { id: household!.id, name: household!.name } : null,
            }}
          />
        </div>
      </BreatheSection>

      <BreatheSection className="mt-8">
        <LinkedAccounts enabledProviders={getEnabledOAuthProviders()} sessionEmail={user.email} />
      </BreatheSection>

      <BreatheSection className="mt-8">
        <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
          <div className="flex items-start gap-4">
            <div className="bg-sunlight/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-2xl">
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
        <div className="bg-secondary rounded-sm p-7">
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
