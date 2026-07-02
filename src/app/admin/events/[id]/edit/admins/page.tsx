import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import EventAdminsClient from './EventAdminsClient';

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
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <a
          href={`/admin/events/${id}/edit`}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          ← Back to Event Edit
        </a>
      </div>

      <EventAdminsClient
        eventId={event.id}
        eventName={event.name}
        initialAdmins={event.admins}
        currentUserId={session.user.id}
      />
    </main>
  );
}
