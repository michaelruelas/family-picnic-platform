import { notFound } from 'next/navigation';
import { requireEventAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import EventAdminsClient from './EventAdminsClient';
import AdminShell from '~/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

async function getEvent(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      admins: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              household: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: event ? `${event.name} - Admins` : 'Event Admins' };
}

export default async function EventAdminsPage({ params }: PageProps) {
  const { id } = await params;
  // FPP-65 / QUB-13.1: per-event guard. HOST users can manage the
  // admin roster for events they have an EventAdmin row for.
  const session = await requireEventAdminPage(id);

  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  return (
    <AdminShell
      title={`${event.name} — Admins`}
      description="Manage who can administer this event"
      actions={
        <a
          href={`/admin/events/${id}/edit`}
          className="border-border bg-card text-foreground hover:bg-secondary rounded-lg border px-4 py-2 text-sm font-medium"
        >
          ← Back to Event
        </a>
      }
    >
      <EventAdminsClient
        eventId={event.id}
        eventName={event.name}
        initialAdmins={event.admins}
        currentUserId={session.user.id}
      />
    </AdminShell>
  );
}
