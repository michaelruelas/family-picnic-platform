import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import AdminCommunicationsClient from './CommunicationsClient';

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

  const [events, households, users] = await Promise.all([
    getEvents(),
    getHouseholds(),
    getUsers(),
  ]);

  const logs = selectedEventId ? await getDeliveryLogs(selectedEventId) : [];

  const effectiveEventId = selectedEventId || events[0]?.id || '';

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900">Admin: Communications</h1>
        <p className="mt-2 text-stone-600">Send broadcast messages to families</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/dashboard"
          className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
        >
          Dashboard
        </Link>
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
          className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-200"
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

      <div className="mb-6">
        <label htmlFor="event-select" className="block text-sm font-medium text-stone-700">
          Event
        </label>
        <select
          id="event-select"
          value={effectiveEventId}
          onChange={(e) => {
            const url = new URL(window.location.href);
            url.searchParams.set('event', e.target.value);
            window.location.href = url.toString();
          }}
          className="mt-1 block w-full max-w-md rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
        >
          <option value="">Select an event...</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} ({new Date(event.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })})
            </option>
          ))}
        </select>
      </div>

      {effectiveEventId ? (
        <AdminCommunicationsClient
          eventId={effectiveEventId}
          households={households}
          users={users}
          initialLogs={logs}
        />
      ) : (
        <div className="rounded-xl bg-stone-100 p-12 text-center">
          <div className="text-5xl">📢</div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">No Event Selected</h2>
          <p className="mt-2 text-stone-600">Select an event to compose and send broadcasts.</p>
        </div>
      )}
    </main>
  );
}
