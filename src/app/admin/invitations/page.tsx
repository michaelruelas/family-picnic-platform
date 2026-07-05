import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import AdminInvitationsClient from './InvitationsClient';

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
  return prisma.invitation.findMany({
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
}

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const params = await searchParams;
  const selectedEventId = params.event || null;

  const [events, households, invitations] = await Promise.all([
    getEvents(),
    getHouseholds(),
    selectedEventId ? getInvitationsByEvent(selectedEventId) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Admin: Invitations</h1>
        <p className="text-muted-foreground mt-2">Send and manage event invitations</p>
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
          className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-4 py-2 text-sm font-medium"
        >
          Invitations
        </Link>
        <Link
          href="/admin/communications"
          className="bg-secondary text-foreground/85 hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium"
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

      <AdminInvitationsClient
        events={events}
        households={households}
        initialInvitations={invitations}
        selectedEventId={selectedEventId}
      />
    </main>
  );
}
