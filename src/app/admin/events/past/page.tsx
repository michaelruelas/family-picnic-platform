import Link from 'next/link';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminShell from '~/components/admin/AdminShell';
import EventsTable, { type AdminEventRow } from '~/components/admin/EventsTable';

export const dynamic = 'force-dynamic';

/**
 * FPP-68 / QUB-12: "Past events" view for the admin. Surfaces two
 * disjoint groups so pre-FPP-68 rows are discoverable without a
 * destructive backfill:
 *
 *   1. Events with `archivedAt IS NOT NULL` — archived on purpose
 *      by a host / super-admin. These dominate the list as the
 *      platform ages.
 *   2. Events with `archivedAt IS NULL` AND `date < now` — legacy
 *      rows that pre-date FPP-68 and have never been archived.
 *
 * The page is read-only in the sense that the actions menu still
 * lives on the active event row, but every event here shows a
 * "Restore" button (unarchive) alongside the normal lifecycle
 * controls so a host can pull a row back into the active list.
 *
 * Exported separately so unit tests can exercise the WHERE clause
 * without spinning up the page render (which redirects non-admins
 * via `requireAdminPage`).
 */
export async function getPastEvents() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      OR: [{ archivedAt: { not: null } }, { archivedAt: null, date: { lt: now } }],
    },
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
  return events;
}

export default async function PastEventsPage() {
  await requireAdminPage();

  const events = await getPastEvents();

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
      title="Past events"
      description="Archive and history of family gatherings"
      actions={
        <Link
          href="/admin/events"
          className="border-border bg-card text-foreground/85 hover:bg-secondary/60 rounded-lg border px-4 py-2 text-sm font-medium"
        >
          ← Back to active events
        </Link>
      }
    >
      <EventsTable
        initialEvents={rows}
        mode="past"
        emptyPastState={{
          title: 'No past events yet',
          description:
            'Events appear here once they pass or when you archive them from the active list.',
          icon: 'archive',
        }}
      />
    </AdminShell>
  );
}
