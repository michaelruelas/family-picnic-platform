import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions, getEnabledOAuthProviders } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import InvitationClient from './InvitationClient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
};

function MessagePage({
  title,
  message,
  eventId,
  hostPhone,
}: {
  title: string;
  message: string;
  eventId?: string;
  hostPhone?: string | null;
}) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-5 py-12">
      <section className="border-border bg-card shadow-card w-full max-w-lg rounded-3xl border p-8 text-center">
        <h1 className="font-display text-foreground text-3xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-4">{message}</p>
        {hostPhone ? (
          <a className="text-terracotta mt-5 inline-block font-semibold" href={`sms:${hostPhone}`}>
            Text the host at {hostPhone}
          </a>
        ) : null}
        {eventId ? (
          <Link
            className="bg-terracotta rounded-pill mt-6 block px-6 py-3 font-semibold text-white"
            href={`/events/${eventId}`}
          >
            View event
          </Link>
        ) : null}
      </section>
    </main>
  );
}

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      event: true,
      invitedBy: { select: { name: true, phoneNumber: true } },
      user: { select: { id: true, deletedAt: true, householdId: true } },
      household: {
        include: {
          members: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, age: true },
          },
        },
      },
    },
  });

  if (!invitation) {
    return (
      <MessagePage
        title="Invitation unavailable"
        message="This invitation link is not valid. Ask the host for a new link."
      />
    );
  }

  const hostPhone = invitation.invitedBy.phoneNumber;
  const existingRsvp = await prisma.rSVP.findFirst({
    where: {
      eventId: invitation.eventId,
      OR: [
        ...(invitation.userId ? [{ userId: invitation.userId }] : []),
        ...(invitation.householdId ? [{ householdId: invitation.householdId }] : []),
      ],
    },
    select: { id: true },
  });

  if (invitation.status === 'USED') {
    return (
      <MessagePage
        title="You already responded"
        message="Your invitation has already been used. Open the event to view or edit your RSVP."
        eventId={invitation.eventId}
        hostPhone={hostPhone}
      />
    );
  }

  if (
    invitation.status === 'EXPIRED' ||
    (invitation.expiresAt && invitation.expiresAt < new Date())
  ) {
    return (
      <MessagePage
        title="Invitation expired"
        message="Ask the host to send you a new invitation."
        hostPhone={hostPhone}
      />
    );
  }

  if (invitation.user?.deletedAt) {
    return (
      <MessagePage
        title="Account unavailable"
        message="This account is no longer available."
        hostPhone={hostPhone}
      />
    );
  }

  if (invitation.event.date < new Date()) {
    return (
      <MessagePage
        title="This event has passed"
        message="RSVPs are closed, but you can still view the event page."
        eventId={invitation.eventId}
      />
    );
  }

  if (existingRsvp) {
    return (
      <MessagePage
        title="You already have an RSVP"
        message="Open the event to view or update your response."
        eventId={invitation.eventId}
      />
    );
  }

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          householdId: true,
          household: {
            select: {
              id: true,
              name: true,
              members: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' },
                select: { id: true, name: true, age: true },
              },
            },
          },
        },
      })
    : null;

  return (
    <InvitationClient
      token={token}
      signedIn={!!sessionUser}
      enabledProviders={getEnabledOAuthProviders()}
      event={{
        id: invitation.event.id,
        name: invitation.event.name,
        date: invitation.event.date.toISOString(),
        location: invitation.event.location,
        deadline: invitation.event.rsvpDeadline?.toISOString() ?? null,
        registrationFeeCents: invitation.event.registrationFeeCents ?? 0,
        registrationFeeMinAge: invitation.event.registrationFeeMinAge,
        currency: invitation.event.currency,
      }}
      host={{ name: invitation.invitedBy.name, phone: hostPhone }}
      household={sessionUser?.household ?? invitation.household}
      stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
      paymentReturnUrl={`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/events/${invitation.event.id}/checkout/return`}
    />
  );
}
