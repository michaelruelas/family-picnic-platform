import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import HouseholdMembersClient from '~/components/household/HouseholdMembersClient';
import HouseholdCreateForm from '~/components/household/HouseholdCreateForm';
import HouseholdRenameForm from '~/components/household/HouseholdRenameForm';
import { BreatheSection } from '~/components/ui/BreatheSection';

export const dynamic = 'force-dynamic';

export default async function HouseholdPage() {
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

  if (!user.household || user.household.deletedAt !== null) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 md:py-20">
        <BreatheSection>
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            Household
          </p>
          <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
            My Household
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-lg">
            Group your family together for RSVPs and planning.
          </p>
        </BreatheSection>

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
      </main>
    );
  }

  const household = user.household;

  const now = new Date();
  const rsvps = await prisma.rSVP.findMany({
    where: {
      householdId: household.id,
      status: 'CONFIRMED',
      event: {
        status: 'PUBLISHED',
        date: { gte: now },
      },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          date: true,
        },
      },
    },
  });

  const totalHeadcount = rsvps.reduce((sum, r) => sum + r.headcount, 0);

  const cumulativeRsvps = rsvps.map((r) => ({
    eventId: r.event.id,
    eventName: r.event.name,
    eventDate: r.event.date,
    headcount: r.headcount,
  }));

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:py-20">
      <BreatheSection>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Household</p>
        <h1 className="font-display text-foreground mt-2 text-5xl font-medium tracking-tight md:text-6xl">
          {household.name}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-lg">
          Your family household dashboard.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <HouseholdRenameForm householdId={household.id} currentName={household.name} />
          <Link
            href="/household/tree"
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-4 py-2 text-sm font-medium"
          >
            View Family Tree
          </Link>
        </div>
      </BreatheSection>

      <BreatheSection className="mt-10">
        <div className="grid gap-6 md:grid-cols-2">
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

            {household.users.length === 0 ? (
              <p className="text-muted-foreground mt-6 text-sm">No account holders yet.</p>
            ) : (
              <ul className="mt-6 space-y-3">
                {household.users.map((member) => (
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

          <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
            <div className="flex items-start gap-4">
              <div className="bg-sunlight/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-2xl">
                📊
              </div>
              <div className="flex-1">
                <h2 className="font-display text-foreground text-2xl font-semibold">
                  Cumulative RSVP Headcount
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Total attendees from your household
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-terracotta text-4xl font-bold">{totalHeadcount}</div>
              <p className="text-muted-foreground mt-1 text-sm">
                {totalHeadcount === 1 ? 'person' : 'people'} attending upcoming events
              </p>
            </div>

            {cumulativeRsvps.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-foreground/85 text-sm font-medium">By event:</p>
                {cumulativeRsvps.map((rsvp) => (
                  <div key={rsvp.eventId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{rsvp.eventName}</span>
                    <span className="text-terracotta font-medium">
                      {rsvp.headcount} {rsvp.headcount === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {totalHeadcount === 0 && (
              <p className="text-muted-foreground mt-4 text-sm">
                No upcoming RSVPs yet. Browse events to RSVP.
              </p>
            )}
          </div>
        </div>
      </BreatheSection>

      <BreatheSection className="mt-8">
        <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
          <HouseholdMembersClient householdId={household.id} initialMembers={household.members} />
        </div>
      </BreatheSection>
    </main>
  );
}
