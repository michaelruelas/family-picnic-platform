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
        <h1 className="text-3xl font-bold text-stone-900">My Household</h1>
        <div className="mt-8 rounded-xl bg-amber-50 p-8 text-center">
          <div className="text-5xl">🏠</div>
          <h2 className="mt-4 text-xl font-semibold text-amber-900">No Household Yet</h2>
          <p className="mt-2 text-amber-700">
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
          <h1 className="text-3xl font-bold text-stone-900">{household.name}</h1>
          <p className="mt-2 text-stone-600">Your family household dashboard</p>
        </div>
        <Link
          href="/household/tree"
          className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-200"
        >
          View Family Tree
        </Link>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">Household Members</h2>
          <p className="mt-1 text-sm text-stone-500">Adults in this household</p>

          {household.users.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">No members yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {household.users.map((member) => (
                <li key={member.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-medium">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{member.name}</p>
                    <p className="text-xs text-stone-500">{member.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">Cumulative RSVP Headcount</h2>
          <p className="mt-1 text-sm text-stone-500">Total attendees from your household</p>

          <div className="mt-4">
            <div className="text-4xl font-bold text-amber-700">{totalHeadcount}</div>
            <p className="mt-1 text-sm text-stone-500">
              {totalHeadcount === 1 ? 'person' : 'people'} attending upcoming events
            </p>
          </div>

          {cumulativeRsvps.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-stone-700">By event:</p>
              {cumulativeRsvps.map((rsvp) => (
                <div key={rsvp.eventId} className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">{rsvp.eventName}</span>
                  <span className="font-medium text-amber-700">
                    {rsvp.headcount} {rsvp.headcount === 1 ? 'person' : 'people'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {totalHeadcount === 0 && (
            <p className="mt-4 text-sm text-stone-500">
              No upcoming RSVPs yet. Browse events to RSVP.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <HouseholdClient
          householdId={household.id}
          initialDependents={household.dependents}
          managedDependents={user.managedDependents}
        />
      </div>
    </main>
  );
}
