import Link from 'next/link';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminShell from '~/components/admin/AdminShell';
import PotluckEventsTable, {
  type AdminPotluckEventRow,
} from '~/components/admin/PotluckEventsTable';

export const dynamic = 'force-dynamic';

/**
 * Global potluck overview. Lists every active event that has at
 * least one potluck slot, with a per-event rollup of slot count
 * and total signups. Each row links to the per-event potluck
 * admin page (`/admin/events/[id]/potluck`) where hosts can edit,
 * cancel, create, and reassign signups.
 *
 * Mirrors the sibling pattern of `/admin/events` and
 * `/admin/events/past` — a top-level entry in the admin sidebar
 * that drills into per-event management surfaces.
 */
export async function getPotluckEvents() {
  return prisma.event.findMany({
    where: {
      archivedAt: null,
      potluckSlots: { some: {} },
    },
    orderBy: { date: 'desc' },
    include: {
      // Pull just the counts we need; the per-event page does the
      // full hydration with household/user joins.
      potluckSlots: {
        select: {
          id: true,
          currentSignups: true,
        },
      },
    },
  });
}

export default async function AdminPotluckPage() {
  await requireAdminPage();

  const events = await getPotluckEvents();

  const rows: AdminPotluckEventRow[] = events.map((event) => {
    const slotCount = event.potluckSlots.length;
    const signupCount = event.potluckSlots.reduce((sum, slot) => sum + slot.currentSignups, 0);
    return {
      id: event.id,
      name: event.name,
      date: event.date.toISOString(),
      status: event.status,
      slotCount,
      signupCount,
    };
  });

  return (
    <AdminShell
      title="Potluck"
      description="Browse and manage potluck signups across every event"
      actions={
        <Link
          href="/admin/events"
          className="border-border bg-card text-foreground/85 hover:bg-secondary/60 rounded-sm border px-4 py-2 text-sm font-medium"
        >
          View all events
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="bg-card space-y-2 rounded-sm p-6 text-center shadow-sm">
          <p className="text-foreground font-semibold">No potluck slots yet</p>
          <p className="text-muted-foreground text-sm">
            Once a host opens a potluck slot on an event, that event will show up here.
          </p>
          <Link
            href="/admin/events"
            className="bg-terracotta hover:bg-terracotta mt-3 inline-block rounded-sm px-4 py-2 text-sm font-medium text-white"
          >
            Open events
          </Link>
        </div>
      ) : (
        <PotluckEventsTable initialRows={rows} />
      )}
    </AdminShell>
  );
}
