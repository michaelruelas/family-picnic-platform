import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminCommunicationsClient from './CommunicationsClient';
import EventSelect from '~/components/admin/EventSelect';
import AdminShell from '~/components/admin/AdminShell';

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
  await requireAdminPage();

  const params = await searchParams;
  const selectedEventId = params.event || null;

  const [events, households, users] = await Promise.all([getEvents(), getHouseholds(), getUsers()]);

  const logs = selectedEventId ? await getDeliveryLogs(selectedEventId) : [];

  const effectiveEventId = selectedEventId || events[0]?.id || '';

  return (
    <AdminShell title="Communications" description="Send broadcast messages to families">
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
    </AdminShell>
  );
}
