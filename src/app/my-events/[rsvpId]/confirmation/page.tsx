import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { RSVPStatus, RsvpAttending } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import { BreatheSection } from '~/components/ui/BreatheSection';
import { RsvpLastUpdated } from '~/components/event/RsvpLastUpdated';
import { FeeTotalBlock } from '~/components/event/FeeTotalBlock';
import { POTLUCK_CATEGORY_LABELS, slotDisplayName } from '~/lib/constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ rsvpId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { rsvpId } = await params;
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: rsvpId },
    include: { event: { select: { name: true } } },
  });
  return {
    title: rsvp ? `${rsvp.event.name} · RSVP confirmation` : 'RSVP confirmation',
  };
}

export default async function RsvpConfirmationPage({ params }: PageProps) {
  const { rsvpId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const rsvp = await prisma.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      event: {
        include: {
          potluckSlots: {
            orderBy: { category: 'asc' },
            select: {
              id: true,
              name: true,
              category: true,
              signups: {
                where: { rsvpId },
                select: { id: true, dishName: true, servings: true },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          household: { select: { id: true, name: true } },
        },
      },
      memberAttendances: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!rsvp) {
    notFound();
  }
  if (rsvp.user.id !== session.user.id) {
    notFound();
  }

  // Registration is keyed by (eventId, userId), not by RSVP id, so we
  // query it separately. Null when no payment row exists yet (free
  // events that never started checkout, or a decline-first RSVP).
  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: rsvp.eventId, userId: rsvp.userId } },
    select: { amountCents: true, currency: true },
  });

  const eventDate = new Date(rsvp.event.date);
  const isPast = eventDate < new Date();
  const rsvpDeadline = rsvp.event.rsvpDeadline ? new Date(rsvp.event.rsvpDeadline) : null;
  const isRsvpEditable = !isPast && (!rsvpDeadline || rsvpDeadline > new Date());

  const yesAttendances = rsvp.memberAttendances.filter((a) => a.attending === RsvpAttending.YES);
  const maybeAttendances = rsvp.memberAttendances.filter(
    (a) => a.attending === RsvpAttending.MAYBE,
  );
  const noAttendances = rsvp.memberAttendances.filter((a) => a.attending === RsvpAttending.NO);

  // No live qualifying-attendee count here. `Registration.amountCents`
  // is a snapshot of the fee at RSVP time, so the live count would
  // diverge from the displayed total after the user edits their
  // roster. The FeeTotalBlock tooltip therefore shows the per-attendee
  // rule without claiming a specific multiplier for this snapshot.

  const potluckClaims = rsvp.event.potluckSlots.flatMap((slot) =>
    slot.signups.map((signup) => ({ slot, signup })),
  );

  const statusLabel: Record<RSVPStatus, { label: string; bg: string; color: string }> = {
    CONFIRMED: { label: 'Confirmed', bg: 'bg-sage/20', color: 'text-sage' },
    WAITLISTED: { label: 'On the waitlist', bg: 'bg-sunlight/30', color: 'text-[#a07c2f]' },
    DECLINED: { label: 'Declined', bg: 'bg-secondary', color: 'text-muted-foreground' },
    PENDING: { label: 'Pending', bg: 'bg-sunlight/20', color: 'text-muted-foreground' },
    INVITED: { label: 'Invited', bg: 'bg-secondary', color: 'text-muted-foreground' },
  };
  const status = statusLabel[rsvp.status];

  return (
    <main className="bg-background pb-24">
      <BreatheSection>
        <div className="mx-auto max-w-3xl px-5 pt-12">
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            Registration confirmation
          </p>
          <h1 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight md:text-5xl">
            {rsvp.event.name}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {eventDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            at {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ·{' '}
            {rsvp.event.location}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${status.bg} ${status.color}`}
            >
              {rsvp.status === 'CONFIRMED' && <span>✓</span>}
              {status.label}
            </span>
            <span className="text-muted-foreground text-sm">
              {rsvp.headcount} {rsvp.headcount === 1 ? 'person' : 'people'} on the way
            </span>
          </div>
          <RsvpLastUpdated modifiedAt={rsvp.modifiedAt} />
        </div>
      </BreatheSection>

      <BreatheSection className="mt-8">
        <div className="mx-auto max-w-3xl px-5">
          <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                  Your household
                </p>
                <h2 className="font-display text-foreground mt-2 text-2xl font-semibold">
                  {rsvp.user.household?.name ?? 'Your household'}
                </h2>
              </div>
              {isRsvpEditable && (
                <Link
                  href={`/events/${rsvp.event.id}`}
                  className="rounded-pill border-border text-foreground hover:border-foreground border px-4 py-2 text-sm font-semibold"
                >
                  Edit RSVP
                </Link>
              )}
            </div>

            {rsvp.memberAttendances.length === 0 ? (
              <p className="text-muted-foreground mt-5 text-sm">
                No household members on this RSVP. Edit to add attendance.
              </p>
            ) : (
              <ul className="divide-border/60 mt-5 divide-y">
                {yesAttendances.length > 0 && (
                  <AttendanceGroup label="Going" tone="sage" count={yesAttendances.length}>
                    {yesAttendances.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-3">
                        <span className="text-foreground font-medium">
                          {a.memberNameSnapshot}
                          {a.memberAgeSnapshot !== null && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              · {a.memberAgeSnapshot} yrs
                            </span>
                          )}
                        </span>
                        <span className="text-sage text-sm font-semibold">
                          {attendingLabel(a.attending)}
                        </span>
                      </li>
                    ))}
                  </AttendanceGroup>
                )}

                {maybeAttendances.length > 0 && (
                  <AttendanceGroup label="Maybe" tone="sunlight" count={maybeAttendances.length}>
                    {maybeAttendances.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-3">
                        <span className="text-foreground font-medium">
                          {a.memberNameSnapshot}
                          {a.memberAgeSnapshot !== null && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              · {a.memberAgeSnapshot} yrs
                            </span>
                          )}
                        </span>
                        <span className="text-sunlight text-sm font-semibold">
                          {attendingLabel(a.attending)}
                        </span>
                      </li>
                    ))}
                  </AttendanceGroup>
                )}

                {noAttendances.length > 0 && (
                  <AttendanceGroup label="Not going" tone="muted" count={noAttendances.length}>
                    {noAttendances.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-3">
                        <span className="text-foreground/85 font-medium">
                          {a.memberNameSnapshot}
                          {a.memberAgeSnapshot !== null && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              · {a.memberAgeSnapshot} yrs
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {attendingLabel(a.attending)}
                        </span>
                      </li>
                    ))}
                  </AttendanceGroup>
                )}
              </ul>
            )}
          </div>
        </div>
      </BreatheSection>

      {/*
        FPP-35: a declined RSVP does not carry potluck claims; the
        confirmation page should thank the user and stop here
        instead of showing the empty "Nothing claimed yet" potluck
        section that previously read as "you forgot to sign up".
      */}
      {rsvp.status !== RSVPStatus.DECLINED && (
        <BreatheSection className="mt-8">
          <div className="mx-auto max-w-3xl px-5">
            <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
              <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                Potluck
              </p>
              <h2 className="font-display text-foreground mt-2 text-2xl font-semibold">
                What you&apos;re bringing
              </h2>
              {potluckClaims.length === 0 ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  Nothing claimed yet. You can sign up for a dish on the{' '}
                  <Link
                    href={`/events/${rsvp.event.id}`}
                    className="text-terracotta underline underline-offset-4"
                  >
                    event page
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-5 space-y-2">
                  {potluckClaims.map(({ slot, signup }) => (
                    <li
                      key={signup.id}
                      className="bg-secondary/40 flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
                    >
                      <span className="text-foreground font-medium">{signup.dishName}</span>
                      <span className="text-muted-foreground text-xs">
                        {slotDisplayName(slot)} · {signup.servings}{' '}
                        {signup.servings === 1 ? 'serving' : 'servings'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </BreatheSection>
      )}

      {rsvp.status === RSVPStatus.DECLINED && (
        <BreatheSection className="mt-8">
          <div className="mx-auto max-w-3xl px-5">
            <div className="bg-secondary/40 rounded-3xl p-7 text-center md:p-9">
              <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                Thanks for letting us know
              </p>
              <h2 className="font-display text-foreground mt-2 text-2xl font-semibold">
                We&apos;ll save your spot for next time
              </h2>
              <p className="text-muted-foreground mt-3 text-sm">
                Your household is on the &ldquo;not going&rdquo; list. If plans change, you can flip
                back to attending from the{' '}
                <Link
                  href={`/events/${rsvp.event.id}`}
                  className="text-terracotta underline underline-offset-4"
                >
                  event page
                </Link>{' '}
                any time before the deadline.
              </p>
            </div>
          </div>
        </BreatheSection>
      )}

      {(registration?.amountCents ?? 0) > 0 && registration && (
        <BreatheSection className="mt-8">
          <div className="mx-auto max-w-3xl px-5">
            <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
              <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Fee</p>
              <h2 className="font-display text-foreground mt-2 text-2xl font-semibold">
                Payment total
              </h2>
              <FeeTotalBlock
                amountCents={registration.amountCents}
                currency={registration.currency}
                perAttendeeCents={rsvp.event.registrationFeeCents ?? undefined}
                minAge={rsvp.event.registrationFeeMinAge}
              />
            </div>
          </div>
        </BreatheSection>
      )}

      <BreatheSection className="mt-10">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <Link
            href="/my-events"
            className="text-muted-foreground hover:text-foreground text-sm font-semibold"
          >
            ← Back to My Events
          </Link>
        </div>
      </BreatheSection>
    </main>
  );
}

function AttendanceGroup({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count: number;
  tone: 'sage' | 'sunlight' | 'muted';
  children: React.ReactNode;
}) {
  const labelClass =
    tone === 'sage'
      ? 'text-sage'
      : tone === 'sunlight'
        ? 'text-[#a07c2f]'
        : 'text-muted-foreground';
  return (
    <li className="py-4 first:pt-0">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold tracking-wide uppercase ${labelClass}`}>{label}</p>
        <p className="text-muted-foreground text-xs">
          {count} {count === 1 ? 'person' : 'people'}
        </p>
      </div>
      <ul className="mt-1">{children}</ul>
    </li>
  );
}
