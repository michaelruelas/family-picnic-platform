import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import AdminCommunicationsClient from './CommunicationsClient';
import EventSelect from '~/components/admin/EventSelect';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ event?: string }>;

async function getEvents() {
  return prisma.event.findMany({
    orderBy: { date: 'desc' },
    select: {
      id: true,
      name: true,
      date: true,
    },
  });
}

async function getHouseholds() {
  return prisma.household.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
    },
  });
}

async function getUsers() {
  return prisma.user.findMany({
    where: { householdId: { not: null } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

async function getDeliveryLogs(eventId: string) {
  return prisma.communicationLog.findMany({
    where: { eventId },
    orderBy: { attemptedAt: 'desc' },
    include: {
      recipient: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export default async function AdminCommunicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const params = await searchParams;
  const selectedEventId = params.event || null;

  const [events, households, users] = await Promise.all([getEvents(), getHouseholds(), getUsers()]);

  const logs = selectedEventId ? await getDeliveryLogs(selectedEventId) : [];

  const effectiveEventId = selectedEventId || events[0]?.id || '';

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Admin: Communications</h1>
        <p className="text-muted-foreground mt-2">Send broadcast messages to families</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/dashboard"
          className="bg-secondary text-foreground/85 hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium"
        >
          Dashboard
        </Link>
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
          className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-4 py-2 text-sm font-medium"
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

      <div className="mb-6">
        <label htmlFor="event-select" className="text-foreground/85 block text-sm font-medium">
          Event
        </label>
        <EventSelect events={events} selectedEventId={effectiveEventId} />
      </div>

      {effectiveEventId ? (
        <AdminCommunicationsClient
          eventId={effectiveEventId}
          households={households}
          users={users}
          initialLogs={logs}
        />
      ) : (
        <div className="bg-secondary rounded-xl p-12 text-center">
          <div className="text-5xl">📢</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No Event Selected</h2>
          <p className="text-muted-foreground mt-2">
            Select an event to compose and send broadcasts.
          </p>
        </div>
      )}
    </main>
  );
}
