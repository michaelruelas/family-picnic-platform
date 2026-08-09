import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireEventAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { RsvpAttending, RSVPStatus } from '~/lib/generated/enums';
import AdminShell from '~/components/admin/AdminShell';
import MembersTable, {
  type AdminMemberRow,
  type AdminHouseholdOption,
} from '~/components/admin/MembersTable';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  return { title: event ? `${event.name} · Members - Admin` : 'Members - Admin' };
}

export default async function EventMembersPage({ params }: PageProps) {
  const { id } = await params;
  // FPP-65 / QUB-13.1: per-event guard. HOST users can view the
  // RSVP member roster for events they have an EventAdmin row for.
  await requireEventAdminPage(id);

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
        // FPP-102: surfaced on the row so the MembersTable modal
        // does not have to re-derive them from the rsvp query.
        userId: rsvp.userId,
        userName: rsvp.user.name,
        userEmail: rsvp.user.email,
      });
    }
  }

  // FPP-102: build the picker for households that do not yet
  // have an RSVP for this event. The MembersTable only renders
  // the picker when this list is non-empty. We load the user
  // list once and join the household roster in a second query so
  // the picker can prefill the per-member attendance grid.
  const userIdsWithRsvp = new Set(event.rsvps.map((r) => r.userId));
  const candidateUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      rsvps: { none: { eventId: id } },
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      household: { select: { id: true, name: true } },
    },
  });

  const candidateHouseholdIds = Array.from(
    new Set(
      candidateUsers.map((u) => u.household?.id).filter((value): value is string => Boolean(value)),
    ),
  );

  const householdMembers =
    candidateHouseholdIds.length > 0
      ? await prisma.householdMember.findMany({
          where: { householdId: { in: candidateHouseholdIds }, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            householdId: true,
            name: true,
            age: true,
            relationship: true,
          },
        })
      : [];

  const membersByHousehold = new Map<string, typeof householdMembers>();
  for (const member of householdMembers) {
    const list = membersByHousehold.get(member.householdId) ?? [];
    list.push(member);
    membersByHousehold.set(member.householdId, list);
  }

  const seenHouseholds = new Set<string>();
  const availableHouseholds: AdminHouseholdOption[] = [];
  for (const user of candidateUsers) {
    // Skip users that have already RSVPed — the page should not
    // offer them in the picker. The Prisma `none` filter already
    // enforces this; the set lookup is a defensive belt-and-braces
    // against a future query rewrite.
    if (userIdsWithRsvp.has(user.id)) continue;
    const householdId = user.household?.id;
    if (!householdId) continue;
    // One entry per household — the picker groups by household
    // so the admin does not see two rows for the same family
    // when both parents exist as users.
    if (seenHouseholds.has(householdId)) continue;
    seenHouseholds.add(householdId);
    const roster = (membersByHousehold.get(householdId) ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      age: m.age,
      relationship: m.relationship,
    }));
    availableHouseholds.push({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      householdId,
      householdName: user.household?.name ?? user.name,
      members: roster,
    });
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
        availableHouseholds={availableHouseholds}
      />
    </AdminShell>
  );
}
