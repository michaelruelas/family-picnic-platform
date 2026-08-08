import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { RsvpAttending, RSVPStatus } from '~/lib/generated/enums';
import AdminShell from '~/components/admin/AdminShell';
import MembersTable, { type AdminMemberRow } from '~/components/admin/MembersTable';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  return { title: event ? `${event.name} · Members - Admin` : 'Members - Admin' };
}

export default async function EventMembersPage({ params }: PageProps) {
  await requireAdminPage();
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      potluckSlots: {
        select: {
          signups: {
            select: {
              dishName: true,
              rsvp: { select: { id: true } },
            },
          },
        },
      },
      rsvps: {
        where: {
          status: {
            in: [RSVPStatus.CONFIRMED, RSVPStatus.WAITLISTED, RSVPStatus.DECLINED],
          },
        },
        orderBy: { respondedAt: 'desc' },
        include: {
          user: {
            include: {
              household: { select: { id: true, name: true } },
            },
          },
          memberAttendances: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const counts: Record<RsvpAttending, number> = {
    [RsvpAttending.YES]: 0,
    [RsvpAttending.NO]: 0,
    [RsvpAttending.MAYBE]: 0,
  };

  // Index dish by rsvp id so we can join in O(1) per member.
  const dishByRsvpId = new Map<string, string | null>();
  for (const slot of event.potluckSlots) {
    for (const signup of slot.signups) {
      const existing = dishByRsvpId.get(signup.rsvp.id);
      // Keep the first non-empty dish name for each RSVP — one row per rsvp.
      if (!existing && signup.dishName) {
        dishByRsvpId.set(signup.rsvp.id, signup.dishName);
      }
    }
  }

  const rows: AdminMemberRow[] = [];
  for (const rsvp of event.rsvps) {
    for (const att of rsvp.memberAttendances) {
      counts[att.attending] += 1;
      rows.push({
        id: att.id,
        memberName: att.memberNameSnapshot,
        memberAge: att.memberAgeSnapshot,
        relationship: null,
        attending: att.attending,
        rsvpStatus: rsvp.status,
        householdId: rsvp.user.household?.id ?? null,
        householdName: rsvp.user.household?.name ?? rsvp.user.name,
        rsvpId: rsvp.id,
        respondedAt: rsvp.respondedAt ? rsvp.respondedAt.toISOString() : null,
        dishName: dishByRsvpId.get(rsvp.id) ?? null,
      });
    }
  }

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AdminShell title="Members">
      <MembersTable
        initialRows={rows}
        eventId={event.id}
        eventStatus={event.status}
        eventName={event.name}
        eventDate={eventDate}
        counts={counts}
      />
    </AdminShell>
  );
}
