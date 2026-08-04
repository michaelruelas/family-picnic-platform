import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { RsvpAttending, RSVPStatus } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import EventStatusBadge from '~/components/event/EventStatusBadge';

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
      rsvps: {
        // Only count attendance for households that actually
        // committed to attending. CONFIRMED and WAITLISTED both
        // carry member attendance rows; PENDING/INVITED are
        // pre-commitment states that contribute no rows, so they
        // are excluded.
        where: {
          status: {
            in: [RSVPStatus.CONFIRMED, RSVPStatus.WAITLISTED],
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

  const eventDate = new Date(event.date);
  const buckets: Record<RsvpAttending, number> = {
    [RsvpAttending.YES]: 0,
    [RsvpAttending.NO]: 0,
    [RsvpAttending.MAYBE]: 0,
  };

  for (const rsvp of event.rsvps) {
    for (const att of rsvp.memberAttendances) {
      buckets[att.attending] += 1;
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
            Admin · Members
          </p>
          <h1 className="text-foreground mt-2 text-3xl font-bold">{event.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {eventDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EventStatusBadge status={event.status} />
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            Back to event
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Going</p>
          <p className="text-sage mt-1 text-2xl font-semibold">{buckets[RsvpAttending.YES]}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Maybe</p>
          <p className="mt-1 text-2xl font-semibold text-[#a07c2f]">
            {buckets[RsvpAttending.MAYBE]}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Not going</p>
          <p className="text-destructive mt-1 text-2xl font-semibold">
            {buckets[RsvpAttending.NO]}
          </p>
        </div>
      </div>

      {event.rsvps.length === 0 ? (
        <div className="bg-secondary rounded-2xl p-12 text-center">
          <div className="text-5xl">📭</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No RSVPs yet</h2>
          <p className="text-muted-foreground mt-2">
            Once households respond, you&apos;ll see per-member attendance here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {event.rsvps.map((rsvp) => {
            const rsvpDate = rsvp.respondedAt ? new Date(rsvp.respondedAt) : null;
            const yesCount = rsvp.memberAttendances.filter(
              (a) => a.attending === RsvpAttending.YES,
            ).length;
            return (
              <div
                key={rsvp.id}
                className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground text-lg font-semibold">
                        {rsvp.user.household?.name ?? rsvp.user.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          rsvp.status === RSVPStatus.CONFIRMED
                            ? 'bg-sage/20 text-sage'
                            : rsvp.status === RSVPStatus.DECLINED
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-terracotta/15 text-terracotta'
                        }`}
                      >
                        {rsvp.status.charAt(0) + rsvp.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {rsvp.user.name} · {rsvp.user.email}
                    </p>
                    {rsvpDate && (
                      <p className="text-muted-foreground/70 mt-1 text-xs">
                        Responded{' '}
                        {rsvpDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-foreground text-sm font-semibold">
                      {yesCount} {yesCount === 1 ? 'going' : 'going'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {rsvp.memberAttendances.length}{' '}
                      {rsvp.memberAttendances.length === 1 ? 'member' : 'members'} on RSVP
                    </p>
                  </div>
                </div>

                {rsvp.memberAttendances.length > 0 ? (
                  <ul className="divide-border/60 mt-4 divide-y">
                    {rsvp.memberAttendances.map((att) => (
                      <li key={att.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-foreground/85">
                          {att.memberNameSnapshot}
                          {att.memberAgeSnapshot !== null && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              · {att.memberAgeSnapshot} yrs
                            </span>
                          )}
                        </span>
                        <span
                          className={
                            att.attending === RsvpAttending.YES
                              ? 'text-sage font-semibold'
                              : att.attending === RsvpAttending.MAYBE
                                ? 'font-semibold text-[#a07c2f]'
                                : 'text-muted-foreground'
                          }
                        >
                          {attendingLabel(att.attending)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground mt-3 text-xs">
                    No member attendance recorded (legacy RSVP).
                  </p>
                )}

                {rsvp.dietaryNotes && (
                  <p className="text-muted-foreground mt-3 text-xs">
                    🥗 Dietary note: {rsvp.dietaryNotes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
