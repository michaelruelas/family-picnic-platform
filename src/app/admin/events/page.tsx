import Link from 'next/link';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminShell from '~/components/admin/AdminShell';
import EventsTable, { type AdminEventRow } from '~/components/admin/EventsTable';

export const dynamic = 'force-dynamic';

async function getEvents() {
  // FPP-68 / QUB-12: archived events (archivedAt IS NOT NULL) live
  // on the dedicated /admin/events/past view. The active list shows
  // every non-archived event regardless of date — pre-FPP-68 rows
  // that were never stamped stay here so a host can still archive
  // them or edit them. Date-desc keeps the next-up event at the top.
  return prisma.event.findMany({
    where: { archivedAt: null },
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

/**
 * Exported for unit tests so the WHERE clause can be asserted
 * without spinning up the page render (which redirects non-admins
 * via `requireAdminPage`).
 */
export const _getEvents = getEvents;

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
    archivedAt: e.archivedAt ? e.archivedAt.toISOString() : null,
  }));

  return (
    <AdminShell
      title="Events"
      description="Manage family picnic events"
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/admin/events/past"
            className="border-border bg-card text-foreground/85 hover:bg-secondary/60 rounded-sm border px-4 py-2 text-sm font-medium"
          >
            Past events
          </Link>
          <Link
            href="/admin/events/new"
            className="bg-terracotta hover:bg-terracotta rounded-sm px-4 py-2 font-medium text-white"
          >
            + New Event
          </Link>
        </div>
      }
    >
      <EventsTable initialEvents={rows} />
    </AdminShell>
  );
}
