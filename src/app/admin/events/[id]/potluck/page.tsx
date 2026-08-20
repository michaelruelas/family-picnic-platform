import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireEventAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus, SlotType } from '~/lib/generated/enums';
import AdminShell from '~/components/admin/AdminShell';
import PotluckSignupsTable, {
  type AdminPotluckSignupRow,
} from '~/components/admin/PotluckSignupsTable';
import type {
  AdminPotluckHouseholdOption,
  AdminPotluckSlotOption,
} from '~/components/admin/PotluckSignupCreateModal';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  return {
    title: event ? `${event.name} · Potluck - Admin` : 'Potluck - Admin',
  };
}

export default async function EventPotluckPage({ params }: PageProps) {
  const { id } = await params;
  // FPP-65 / QUB-13.1: per-event guard. Platform-level admins OR
  // a HOST with an EventAdmin row for this event can manage signups.
  await requireEventAdminPage(id);

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      potluckSlots: {
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          category: true,
          slotType: true,
          maxSignups: true,
          currentSignups: true,
          // FPP-Postmortem: filter out soft-deleted signups so the
          // admin table doesn't surface cancelled-without-purge rows.
          signups: {
            where: { deletedAt: null },
            orderBy: { claimedAt: 'asc' },
            select: {
              id: true,
              slotId: true,
              rsvpId: true,
              dishName: true,
              servings: true,
              rsvp: {
                select: {
                  id: true,
                  status: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      household: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      rsvps: {
        where: {
          status: {
            // Hosts need to be able to claim on behalf of a household
            // even if the RSVP is waitlisted/invited (so hosts can
            // backfill claims as RSVPs come in). DECLINED is excluded
            // because a household that declined the event shouldn't
            // be on the potluck admin picker.
            in: [
              RSVPStatus.CONFIRMED,
              RSVPStatus.WAITLISTED,
              RSVPStatus.PENDING,
              RSVPStatus.INVITED,
            ],
          },
        },
        orderBy: { respondedAt: 'desc' },
        select: {
          id: true,
          status: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              household: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  // Flatten slot × signup into a single rows array for the table.
  const rows: AdminPotluckSignupRow[] = [];
  for (const slot of event.potluckSlots) {
    for (const signup of slot.signups) {
      rows.push({
        id: signup.id,
        slotId: slot.id,
        slotName: slot.name,
        slotCategory: slot.category,
        slotType: slot.slotType,
        slotMaxSignups: slot.maxSignups,
        slotCurrentSignups: slot.currentSignups,
        rsvpId: signup.rsvp.id,
        userId: signup.rsvp.user.id,
        userName: signup.rsvp.user.name,
        userEmail: signup.rsvp.user.email,
        householdId: signup.rsvp.user.household?.id ?? null,
        householdName: signup.rsvp.user.household?.name ?? signup.rsvp.user.name,
        dishName: signup.dishName,
        servings: signup.servings,
      });
    }
  }

  // Build the slot picker for the create + reassign modals.
  const slots: AdminPotluckSlotOption[] = event.potluckSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    category: slot.category,
    slotType: slot.slotType as keyof typeof SlotType,
    maxSignups: slot.maxSignups,
    currentSignups: slot.currentSignups,
  }));

  // Build the household picker. One entry per RSVP so the picker
  // shows the waitlist/invited households alongside the confirmed
  // ones — admins need to be able to claim on behalf of any
  // household that has touched the event.
  const households: AdminPotluckHouseholdOption[] = event.rsvps.map((rsvp) => ({
    rsvpId: rsvp.id,
    userId: rsvp.user.id,
    userName: rsvp.user.name,
    userEmail: rsvp.user.email,
    householdId: rsvp.user.household?.id ?? null,
    householdName: rsvp.user.household?.name ?? rsvp.user.name,
    rsvpStatus: rsvp.status,
  }));

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AdminShell title="Potluck">
      <PotluckSignupsTable
        eventId={event.id}
        eventStatus={event.status}
        eventName={event.name}
        eventDate={eventDate}
        initialRows={rows}
        slots={slots}
        households={households}
      />
    </AdminShell>
  );
}
