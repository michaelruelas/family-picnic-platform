import { requireAdminPage } from '~/lib/admin-auth';
import { ADMIN_ROLES } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { listAuditLogEntries } from '~/server/audit-entries';
import AuditLogTable from '~/components/admin/AuditLogTable';

export const dynamic = 'force-dynamic';

async function getInitialLogs() {
  // FPP-50: seed the page with merged entries from both AdminAuditLog
  // (admin actions) and the new AuditLog table (domain events).
  return listAuditLogEntries({});
}

async function getEvents() {
  return prisma.event.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { date: 'desc' },
  });
}

async function getUsers() {
  return prisma.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] } },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

export default async function AdminAuditLogPage() {
  await requireAdminPage();

  const [logs, events, users] = await Promise.all([getInitialLogs(), getEvents(), getUsers()]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Admin: Audit Log</h1>
        <p className="text-muted-foreground mt-2">
          Track admin actions and domain events (signups, RSVP changes, registrations, payment
          events, host assignment).
        </p>
      </div>

      <AuditLogTable initialLogs={logs} events={events} users={users} />
    </main>
  );
}
