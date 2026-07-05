import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import HouseholdClient from '~/components/household/HouseholdClient';

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
          users: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          dependents: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              relationship: true,
              age: true,
              dietaryLabels: true,
              isChild: true,
            },
          },
        },
      },
      managedDependents: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          relationship: true,
          age: true,
          dietaryLabels: true,
          isChild: true,
          householdId: true,
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  if (!user.household) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-foreground text-3xl font-bold">My Household</h1>
        <div className="bg-sunlight/20 mt-8 rounded-xl p-8 text-center">
          <div className="text-5xl">🏠</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No Household Yet</h2>
          <p className="text-terracotta mt-2">
            You are not part of a household. Contact an admin to be added to a household.
          </p>
        </div>
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
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold">{household.name}</h1>
          <p className="text-muted-foreground mt-2">Your family household dashboard</p>
        </div>
        <Link
          href="/household/tree"
          className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-4 py-2 text-sm font-medium"
        >
          View Family Tree
        </Link>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <h2 className="text-foreground text-lg font-semibold">Household Members</h2>
          <p className="text-muted-foreground mt-1 text-sm">Adults in this household</p>

          {household.users.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">No members yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {household.users.map((member) => (
                <li key={member.id} className="flex items-center gap-3">
                  <div className="bg-terracotta/15 text-terracotta flex h-10 w-10 items-center justify-center rounded-full font-medium">
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

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <h2 className="text-foreground text-lg font-semibold">Cumulative RSVP Headcount</h2>
          <p className="text-muted-foreground mt-1 text-sm">Total attendees from your household</p>

          <div className="mt-4">
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

      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <HouseholdClient initialDependents={household.dependents} />
      </div>
    </main>
  );
}
