import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminInvitationsClient from './InvitationsClient';
import AdminShell from '~/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

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

async function getInvitationsByEvent(eventId: string) {
  const rows = await prisma.invitation.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    include: {
      household: {
        select: { id: true, name: true },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    householdId: r.householdId,
    userId: r.userId,
    status: r.status,
    token: r.token,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    household: r.household,
    user: r.user,
  }));
}

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const selectedEventId = params.event || null;

  const [events, households, invitations] = await Promise.all([
    getEvents(),
    getHouseholds(),
    selectedEventId ? getInvitationsByEvent(selectedEventId) : Promise.resolve([]),
  ]);

  return (
    <AdminShell title="Invitations" description="Send and manage event invitations">
      <AdminInvitationsClient
        events={events}
        households={households}
        initialInvitations={invitations}
        selectedEventId={selectedEventId}
      />
    </AdminShell>
  );
}
