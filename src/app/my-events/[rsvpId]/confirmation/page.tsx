import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { ChargeStatus, RefundStatus, RSVPStatus, RsvpAttending } from '~/lib/generated/enums';
import { attendingLabel } from '~/lib/schemas/rsvp-member-attendance';
import { BreatheSection } from '~/components/ui/BreatheSection';
import { RsvpLastUpdated } from '~/components/event/RsvpLastUpdated';
import { FeeTotalBlock } from '~/components/event/FeeTotalBlock';
import { calculateFee } from '~/lib/fee';
import { formatAmount } from '~/lib/currency';
import { POTLUCK_CATEGORY_LABELS, slotDisplayName } from '~/lib/constants';
import PotluckTable from '~/components/potluck/PotluckTable';

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
              slotType: true,
              maxSignups: true,
              currentSignups: true,
              signups: {
                where: { rsvp: { status: 'CONFIRMED' } },
                select: {
                  id: true,
                  dishName: true,
                  servings: true,
                  dietaryLabels: true,
                  rsvpId: true,
                  rsvp: {
                    select: {
                      id: true,
                      userId: true,
                      user: {
                        select: {
                          id: true,
                          name: true,
                          household: { select: { name: true } },
                        },
                      },
                    },
                  },
                },
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
  // query it separately. Includes every charge and refund so the fee
  // section can show the live total, the running paid sum, and a
  // per-charge history. Null when no payment row exists yet (free
  // events that never started checkout, or a decline-first RSVP).
  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: rsvp.eventId, userId: rsvp.userId } },
    select: {
      amountCents: true,
      currency: true,
      status: true,
      charges: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          amountCents: true,
          currency: true,
          status: true,
          receiptUrl: true,
          createdAt: true,
        },
      },
      refunds: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          amountCents: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      },
    },
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

  // FPP-124: compute the live registration fee from the event config
  // and the current roster so the confirmation screen stays accurate
  // even after the user adds attendees. `Registration.amountCents`
  // is intentionally kept as the historical snapshot of the fee at
  // first charge time (see prisma/schema.prisma); the live total here
  // is derived on read and never persisted back to the row.
  const liveFeeBreakdown =
    rsvp.event.registrationFeeCents && rsvp.event.registrationFeeCents > 0
      ? calculateFee(
          rsvp.memberAttendances.map((a) => ({
            attending: a.attending,
            memberAge: a.memberAgeSnapshot,
          })),
          {
            amountCents: rsvp.event.registrationFeeCents,
            minAge: rsvp.event.registrationFeeMinAge,
          },
        )
      : { amountCents: 0, qualifyingAttendees: 0, totalAttendees: 0 };

  // Sum SUCCEEDED charges / refunds so the user sees the actual money
  // trail. Pending / failed / canceled rows are excluded so the
  // totals agree with what Stripe has actually captured.
  const succeededCharges =
    registration?.charges.filter((c) => c.status === ChargeStatus.SUCCEEDED) ?? [];
  const succeededRefunds =
    registration?.refunds.filter((r) => r.status === RefundStatus.SUCCEEDED) ?? [];
  const amountPaidCents = succeededCharges.reduce((sum, c) => sum + c.amountCents, 0);
  const amountRefundedCents = succeededRefunds.reduce((sum, r) => sum + r.amountCents, 0);
  const netPaidCents = amountPaidCents - amountRefundedCents;
  const outstandingCents = Math.max(0, liveFeeBreakdown.amountCents - netPaidCents);
  const overpaidCents = Math.max(0, netPaidCents - liveFeeBreakdown.amountCents);

  // FPP-124: feed both the snapshot and the live total into the block
  // so the user can see "the registration is now $X, you originally
  // paid $Y, current balance $Z" rather than a single frozen number.
  const showFeeSection =
    registration &&
    (liveFeeBreakdown.amountCents > 0 ||
      succeededCharges.length > 0 ||
      (registration.amountCents ?? 0) > 0);

  const potluckClaims = rsvp.event.potluckSlots.flatMap((slot) =>
    slot.signups.filter((signup) => signup.rsvpId === rsvpId).map((signup) => ({ slot, signup })),
  );

  const statusLabel: Record<RSVPStatus, { label: string; bg: string; color: string }> = {
    CONFIRMED: { label: 'Confirmed', bg: 'bg-sage/20', color: 'text-sage' },
    WAITLISTED: {
      label: 'On the waitlist',
      bg: 'bg-sunlight/25',
      color: 'text-sunlight-foreground',
    },
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
              className={`inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold ${status.bg} ${status.color}`}
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
          <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
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
                  className="border-border text-foreground hover:border-foreground rounded-sm border px-4 py-2 text-sm font-semibold"
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
            <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
              <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
                Potluck
              </p>
              <h2 className="font-display text-foreground mt-2 text-2xl font-semibold">
                What you&apos;re bringing
              </h2>
              {rsvp.status === RSVPStatus.WAITLISTED ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  You&apos;re currently on the waitlist. Once your RSVP is confirmed, you&apos;ll be
                  able to claim a dish for the potluck.
                </p>
              ) : potluckClaims.length === 0 ? (
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
                  {potluckClaims.map(({ slot, signup }) => {
                    const displayName = signup.dishName || slotDisplayName(slot);
                    const categoryLabel =
                      POTLUCK_CATEGORY_LABELS[
                        slot.category as keyof typeof POTLUCK_CATEGORY_LABELS
                      ] ?? slot.category;
                    const details = [
                      signup.dishName ? slotDisplayName(slot) : categoryLabel,
                      `${signup.servings} ${signup.servings === 1 ? 'serving' : 'servings'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ');

                    return (
                      <li
                        key={signup.id}
                        className="bg-secondary/40 flex items-center justify-between gap-3 rounded-sm px-4 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-foreground block truncate font-medium">
                            {displayName}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {details}
                          </span>
                        </div>
                        <span className="bg-sage/20 text-sage inline-flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-semibold">
                          <span>✓</span> Signed up
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </BreatheSection>
      )}

      {rsvp.status !== RSVPStatus.DECLINED && (
        <BreatheSection className="mt-8">
          <div className="mx-auto max-w-3xl px-5">
            <PotluckTable slots={rsvp.event.potluckSlots} currentRsvpId={rsvp.id} />
          </div>
        </BreatheSection>
      )}

      {rsvp.status === RSVPStatus.DECLINED && (
        <BreatheSection className="mt-8">
          <div className="mx-auto max-w-3xl px-5">
            <div className="bg-secondary/40 rounded-sm p-7 text-center md:p-9">
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

      {showFeeSection && registration && (
        <BreatheSection className="mt-8">
          <div className="mx-auto max-w-3xl px-5">
            <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
              <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Fee</p>
              <h2 className="font-display text-foreground mt-2 text-2xl font-semibold">
                Payment total
              </h2>

              <div className="mt-6 space-y-4">
                {/* Live total — recomputed from event config + roster so
                    attendees added after the first charge show up here. */}
                <FeeTotalBlock
                  amountCents={liveFeeBreakdown.amountCents}
                  currency={registration.currency}
                  perAttendeeCents={rsvp.event.registrationFeeCents ?? undefined}
                  qualifyingAttendees={liveFeeBreakdown.qualifyingAttendees}
                  minAge={rsvp.event.registrationFeeMinAge}
                />

                {/*
                  FPP-124: keep the historical snapshot visible so the
                  user can see what they originally paid for, but
                  follow it with the running paid/remaining totals
                  so the block doesn't read as a frozen $5 after the
                  user has settled a top-up. The snapshot is shown
                  only when it differs from the live total so a
                  single-charge registration doesn't display the same
                  number twice.
                */}
                {registration.amountCents !== liveFeeBreakdown.amountCents && (
                  <div className="border-border/60 bg-secondary/30 rounded-sm border px-4 py-3 text-sm">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      First-charge snapshot
                    </p>
                    <p className="text-foreground mt-1 text-base font-semibold">
                      {formatAmount(registration.amountCents, registration.currency)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Captured at the original payment. Subsequent top-ups for added attendees keep
                      this row as the historical record while the live total above tracks the
                      current roster.
                    </p>
                  </div>
                )}

                <div className="border-border/60 bg-secondary/30 rounded-sm border px-4 py-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      Paid so far
                    </span>
                    <span
                      className="text-foreground text-base font-semibold"
                      data-testid="confirmation-paid-total"
                    >
                      {formatAmount(netPaidCents, registration.currency)}
                    </span>
                  </div>
                  {succeededRefunds.length > 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Includes {formatAmount(amountRefundedCents, registration.currency)} refunded.
                    </p>
                  )}
                </div>

                {outstandingCents > 0 && (
                  <div
                    className="border-sunlight/40 bg-sunlight/15 rounded-sm border px-4 py-3 text-sm"
                    data-testid="confirmation-outstanding"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
                        Balance owed
                      </span>
                      <span className="text-foreground text-base font-semibold">
                        {formatAmount(outstandingCents, registration.currency)}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Settle up from the event page before the deadline.
                    </p>
                  </div>
                )}

                {overpaidCents > 0 && (
                  <div
                    className="border-border/60 bg-secondary/30 rounded-sm border px-4 py-3 text-sm"
                    data-testid="confirmation-overpaid"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        Overpaid
                      </span>
                      <span className="text-foreground text-base font-semibold">
                        {formatAmount(overpaidCents, registration.currency)}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      You paid more than the current fee. Contact the organizer if you&apos;d like a
                      refund.
                    </p>
                  </div>
                )}

                {/*
                  FPP-124: per-charge history so the user can see exactly
                  what they were charged and when, instead of a single
                  opaque snapshot. Failed / pending / canceled charges
                  are listed too so a stuck card shows up here rather
                  than silently disappearing from the receipt trail.
                */}
                {registration.charges.length > 0 && (
                  <div className="border-border/60 rounded-sm border px-4 py-3 text-sm">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      Payment history
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {registration.charges.map((charge) => (
                        <li
                          key={charge.id}
                          className="flex items-baseline justify-between gap-3"
                          data-testid="confirmation-charge-row"
                          data-charge-status={charge.status}
                        >
                          <span className="text-foreground/85 min-w-0 truncate text-xs">
                            Charge · {new Date(charge.createdAt).toLocaleString('en-US')}
                          </span>
                          <span className="text-foreground shrink-0 text-xs font-semibold">
                            {formatAmount(charge.amountCents, charge.currency)}
                            {charge.status !== ChargeStatus.SUCCEEDED && (
                              <span className="text-muted-foreground ml-2 text-xs font-normal">
                                ({charge.status.toLowerCase().replace(/_/g, ' ')})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                      {registration.refunds.map((refund) => (
                        <li
                          key={refund.id}
                          className="flex items-baseline justify-between gap-3"
                          data-testid="confirmation-refund-row"
                          data-refund-status={refund.status}
                        >
                          <span className="text-foreground/85 min-w-0 truncate text-xs">
                            Refund · {new Date(refund.createdAt).toLocaleString('en-US')}
                          </span>
                          <span className="text-foreground shrink-0 text-xs font-semibold">
                            −{formatAmount(refund.amountCents, refund.currency)}
                            {refund.status !== RefundStatus.SUCCEEDED && (
                              <span className="text-muted-foreground ml-2 text-xs font-normal">
                                ({refund.status.toLowerCase().replace(/_/g, ' ')})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
        ? 'text-sunlight-foreground'
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
