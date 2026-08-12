import { notFound } from 'next/navigation';
import { requireEventAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import EventForm from '~/components/event/EventForm';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import SlotGrid from '~/components/potluck/SlotGrid';
import AdminShell from '~/components/admin/AdminShell';
import ItineraryEditor from '~/components/event/ItineraryEditor';
import EventAttachmentsEditor from '~/components/event/EventAttachmentsEditor';

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
      // FPP-45 / QUB-31.2: itinerary rows for the drag-to-reorder
      // editor. Order by `order` ascending so the editor's initial
      // paint matches the stored order; the editor defends against
      // a stale list by re-fetching on action.
      itineraryItems: {
        orderBy: { order: 'asc' },
      },
      // FPP-43 / FPP-2: PDF attachments for the admin editor.
      attachments: {
        orderBy: { createdAt: 'asc' },
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
  const { id } = await params;
  // FPP-65 / QUB-13.1: per-event guard. Platform-level admins OR
  // a HOST with an EventAdmin row for this event can edit it.
  await requireEventAdminPage(id);

  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  const initialData = {
    id: event.id,
    name: event.name,
    date: event.date.toISOString().slice(0, 16),
    location: event.location,
    lat: event.lat,
    lng: event.lng,
    placeId: event.placeId,
    description: event.description,
    rsvpDeadline: event.rsvpDeadline?.toISOString().slice(0, 16) ?? '',
    maxCapacity: event.maxCapacity ?? undefined,
    mapImageUrl: event.mapImageUrl ?? '',
    // FPP-60: pre-fill the featured image so the host can see/replace
    // the currently-set hero in edit mode.
    featuredImageUrl: event.featuredImageUrl ?? '',
    registrationFeeCents: event.registrationFeeCents ?? 0,
    registrationFeeMinAge: event.registrationFeeMinAge ?? 0,
  };

  return (
    <AdminShell
      title={
        <span className="flex items-center gap-3">
          Edit Event
          <EventStatusBadge status={event.status} />
        </span>
      }
      description="Update the details for your family picnic"
    >
      <EventForm initialData={initialData} mode="edit" />

      <div className="mt-12">
        <h2 className="text-foreground text-2xl font-bold">Itinerary</h2>
        <p className="text-muted-foreground mt-2">
          Build the day-of schedule. Drag rows to reorder, or use the arrow buttons.
        </p>
        <div className="mt-6">
          <ItineraryEditor eventId={event.id} initialItems={event.itineraryItems} />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-foreground text-2xl font-bold">Potluck Slots</h2>
        <p className="text-muted-foreground mt-2">
          Manage what dishes attendees can sign up to bring
        </p>
        <div className="mt-6">
          <SlotGrid eventId={event.id} slots={event.potluckSlots} />
        </div>
      </div>

      <div className="mt-12 border-t pt-12">
        <h2 className="text-foreground text-2xl font-bold">PDF Attachments</h2>
        <p className="text-muted-foreground mt-2">
          Share directions, waivers, or the day-of schedule with guests
        </p>
        <div className="mt-6">
          <EventAttachmentsEditor
            eventId={event.id}
            initialAttachments={event.attachments.map((a) => ({
              id: a.id,
              filename: a.filename,
              contentType: a.contentType,
              sizeBytes: a.sizeBytes,
              virusScanStatus: a.virusScanStatus,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>

      <div className="border-border mt-12 border-t pt-12">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-2xl font-bold">RSVP Members</h2>
            <p className="text-muted-foreground mt-2">
              See per-member attendance for every household that responded
            </p>
          </div>
          <a
            href={`/admin/events/${event.id}/members`}
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-4 py-2 text-sm font-medium"
          >
            View members
          </a>
        </div>
      </div>

      <div className="border-border mt-12 border-t pt-12">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-2xl font-bold">Event Admins</h2>
            <p className="text-muted-foreground mt-2">Manage who can administer this event</p>
          </div>
          <a
            href={`/admin/events/${event.id}/edit/admins`}
            className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            Manage Admins
          </a>
        </div>
      </div>
    </AdminShell>
  );
}
