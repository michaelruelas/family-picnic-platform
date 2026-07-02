import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import EventForm from '~/components/event/EventForm';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import SlotGrid from '~/components/potluck/SlotGrid';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

async function getEvent(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      potluckSlots: {
        orderBy: { category: 'asc' },
        include: {
          signups: {
            select: {
              id: true,
              dishName: true,
              servings: true,
              dietaryLabels: true,
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
  return { title: event ? `Edit ${event.name} - Admin` : 'Edit Event - Admin' };
}

export default async function EditEventPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  const initialData = {
    id: event.id,
    name: event.name,
    date: event.date.toISOString().slice(0, 16),
    location: event.location,
    description: event.description,
    rsvpDeadline: event.rsvpDeadline?.toISOString().slice(0, 16) ?? '',
    maxCapacity: event.maxCapacity ?? undefined,
    mapImageUrl: event.mapImageUrl ?? '',
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-stone-900">Edit Event</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="mt-2 text-stone-600">Update the details for your family picnic</p>
      </div>

      <EventForm initialData={initialData} mode="edit" />

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-stone-900">Potluck Slots</h2>
        <p className="mt-2 text-stone-600">Manage what dishes attendees can sign up to bring</p>
        <div className="mt-6">
          <SlotGrid eventId={event.id} slots={event.potluckSlots} />
        </div>
      </div>
    </main>
  );
}
