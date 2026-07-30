import { requireAdminPage } from '~/lib/admin-auth';
import { ADMIN_ROLES } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import AuditLogTable from '~/components/admin/AuditLogTable';

export const dynamic = 'force-dynamic';

async function getInitialLogs() {
  return prisma.adminAuditLog.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
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
        <p className="text-muted-foreground mt-2">Track all administrative actions</p>
      </div>

      <AuditLogTable initialLogs={logs} events={events} users={users} />
    </main>
  );
}
