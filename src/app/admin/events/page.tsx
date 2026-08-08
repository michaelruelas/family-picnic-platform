import Link from 'next/link';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminShell from '~/components/admin/AdminShell';
import EventsTable, { type AdminEventRow } from '~/components/admin/EventsTable';

export const dynamic = 'force-dynamic';

async function getEvents() {
  return prisma.event.findMany({
    orderBy: { date: 'desc' },
    include: {
      _count: {
        select: {
          rsvps: true,
          potluckSlots: true,
        },
      },
    },
  });
}

export default async function AdminEventsPage() {
  await requireAdminPage();

  const events = await getEvents();

  const rows: AdminEventRow[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date.toISOString(),
    status: e.status,
    location: e.location,
    rsvpCount: e._count.rsvps,
    potluckSlotCount: e._count.potluckSlots,
    maxCapacity: e.maxCapacity ?? null,
    rsvpDeadline: e.rsvpDeadline ? e.rsvpDeadline.toISOString() : null,
  }));

  return (
    <AdminShell
      title="Events"
      description="Manage family picnic events"
      actions={
        <Link
          href="/admin/events/new"
          className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 font-medium text-white"
        >
          + New Event
        </Link>
      }
    >
      <EventsTable initialEvents={rows} />
    </AdminShell>
  );
}
