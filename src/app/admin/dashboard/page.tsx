import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus } from '~/lib/generated/enums';
import DashboardCard from '~/components/admin/DashboardCard';

export const dynamic = 'force-dynamic';

async function getEventsWithDashboard() {
  const events = await prisma.event.findMany({
    orderBy: { date: 'desc' },
  });

  const eventsWithDashboard = await Promise.all(
    events.map(async (event) => {
      const rsvps = await prisma.rSVP.findMany({
        where: { eventId: event.id },
      });

      const confirmedRsvps = rsvps.filter((r) => r.status === RSVPStatus.CONFIRMED);
      const declinedRsvps = rsvps.filter((r) => r.status === RSVPStatus.DECLINED);
      const pendingRsvps = rsvps.filter(
        (r) => r.status === RSVPStatus.PENDING || r.status === RSVPStatus.INVITED,
      );
      const totalHeadcount = confirmedRsvps.reduce((sum, r) => sum + r.headcount, 0);

      const potluckSlots = await prisma.potluckSlot.findMany({
        where: { eventId: event.id },
        include: {
          signups: {
            include: {
              rsvp: true,
            },
          },
        },
      });

      const foodSummary: Record<string, { category: string; items: string[] }> = {};
      for (const slot of potluckSlots) {
        const categoryEntry = foodSummary[slot.category] ?? {
          category: slot.category,
          items: [],
        };
        foodSummary[slot.category] = categoryEntry;
        for (const signup of slot.signups) {
          if (signup.rsvp.status === RSVPStatus.CONFIRMED) {
            categoryEntry.items.push(`${signup.dishName} (${signup.servings} servings)`);
          }
        }
      }

      const recentAuditLogs = await prisma.adminAuditLog.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      });

      return {
        event,
        rsvpSummary: {
          total: rsvps.length,
          confirmed: confirmedRsvps.length,
          declined: declinedRsvps.length,
          pending: pendingRsvps.length,
          headcount: totalHeadcount,
        },
        foodSummary: Object.values(foodSummary),
        recentAuditLogs,
      };
    }),
  );

  return eventsWithDashboard;
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const eventsWithDashboard = await getEventsWithDashboard();

  const totalConfirmed = eventsWithDashboard.reduce(
    (sum, e) => sum + e.rsvpSummary.confirmed,
    0,
  );
  const totalHeadcount = eventsWithDashboard.reduce(
    (sum, e) => sum + e.rsvpSummary.headcount,
    0,
  );
  const totalPending = eventsWithDashboard.reduce(
    (sum, e) => sum + e.rsvpSummary.pending,
    0,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900">Admin Dashboard</h1>
        <p className="mt-2 text-stone-600">Overview of all family picnic events</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/events"
          className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
        >
          Events
        </Link>
        <Link
          href="/admin/invitations"
          className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
        >
          Invitations
        </Link>
        <Link
          href="/admin/communications"
          className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
        >
          Communications
        </Link>
        <Link
          href="/admin/audit-log"
          className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
        >
          Audit Log
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">Total RSVPs</p>
          <p className="mt-1 text-3xl font-semibold text-stone-900">
            {eventsWithDashboard.reduce((sum, e) => sum + e.rsvpSummary.total, 0)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">Total Confirmed</p>
          <p className="mt-1 text-3xl font-semibold text-green-600">{totalConfirmed}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">Total Headcount</p>
          <p className="mt-1 text-3xl font-semibold text-stone-900">{totalHeadcount}</p>
        </div>
      </div>

      {eventsWithDashboard.length === 0 ? (
        <div className="rounded-2xl bg-stone-100 p-12 text-center">
          <div className="text-5xl">📊</div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">No Events Yet</h2>
          <p className="mt-2 text-stone-600">
            Create your first event to start seeing dashboard metrics.
          </p>
          <Link
            href="/admin/events/new"
            className="mt-6 inline-block rounded-lg bg-amber-600 px-6 py-2 font-medium text-white hover:bg-amber-700"
          >
            Create First Event
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {eventsWithDashboard.map(({ event, rsvpSummary, foodSummary }) => (
            <DashboardCard
              key={event.id}
              eventId={event.id}
              eventName={event.name}
              eventDate={new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              eventStatus={event.status}
              rsvpSummary={rsvpSummary}
              foodSummary={foodSummary}
              maxCapacity={event.maxCapacity}
            />
          ))}
        </div>
      )}
    </main>
  );
}
