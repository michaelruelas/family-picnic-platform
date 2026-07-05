import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus } from '~/lib/generated/enums';
import DashboardCard from '~/components/admin/DashboardCard';
import { getDietarySummary } from '~/lib/dietary';

export const dynamic = 'force-dynamic';

async function getEventsWithDashboard() {
  const events = await prisma.event.findMany({
    orderBy: { date: 'desc' },
  });

  const eventsWithDashboard = await Promise.all(
    events.map(async (event) => {
      const rsvps = await prisma.rSVP.findMany({
        where: { eventId: event.id },
        include: {
          user: {
            include: {
              household: true,
            },
          },
        },
      });

      const confirmedRsvps = rsvps.filter((r) => r.status === RSVPStatus.CONFIRMED);
      const dietarySummary = getDietarySummary(confirmedRsvps);
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
        dietarySummary,
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

  const totalConfirmed = eventsWithDashboard.reduce((sum, e) => sum + e.rsvpSummary.confirmed, 0);
  const totalHeadcount = eventsWithDashboard.reduce((sum, e) => sum + e.rsvpSummary.headcount, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of all family picnic events</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/events"
          className="bg-secondary text-foreground/85 hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium"
        >
          Events
        </Link>
        <Link
          href="/admin/invitations"
          className="bg-secondary text-foreground/85 hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium"
        >
          Invitations
        </Link>
        <Link
          href="/admin/communications"
          className="bg-secondary text-foreground/85 hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium"
        >
          Communications
        </Link>
        <Link
          href="/admin/audit-log"
          className="bg-secondary text-foreground/85 hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium"
        >
          Audit Log
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-muted-foreground text-sm">Total RSVPs</p>
          <p className="text-foreground mt-1 text-3xl font-semibold">
            {eventsWithDashboard.reduce((sum, e) => sum + e.rsvpSummary.total, 0)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-muted-foreground text-sm">Total Confirmed</p>
          <p className="text-sage mt-1 text-3xl font-semibold">{totalConfirmed}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-muted-foreground text-sm">Total Headcount</p>
          <p className="text-foreground mt-1 text-3xl font-semibold">{totalHeadcount}</p>
        </div>
      </div>

      {eventsWithDashboard.length === 0 ? (
        <div className="bg-secondary rounded-2xl p-12 text-center">
          <div className="text-5xl">📊</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No Events Yet</h2>
          <p className="text-muted-foreground mt-2">
            Create your first event to start seeing dashboard metrics.
          </p>
          <Link
            href="/admin/events/new"
            className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-lg px-6 py-2 font-medium text-white"
          >
            Create First Event
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {eventsWithDashboard.map(({ event, rsvpSummary, foodSummary, dietarySummary }) => (
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
              dietarySummary={dietarySummary}
              maxCapacity={event.maxCapacity}
            />
          ))}
        </div>
      )}
    </main>
  );
}
