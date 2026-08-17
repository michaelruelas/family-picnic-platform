import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { EventStatus, RegistrationStatus } from '~/lib/generated/enums';
import { isConfigured as stripeConfigured, getPublishableKey } from '~/lib/stripe';
import { formatAmount } from '~/lib/currency';
import PaymentForm from '~/components/payment/PaymentForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: event ? `Register for ${event.name}` : 'Register' };
}

export default async function CheckoutPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/events/${id}/checkout`)}`);
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      registrationFeeCents: true,
      currency: true,
    },
  });
  if (!event) notFound();
  if (event.status !== EventStatus.PUBLISHED) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-foreground text-3xl font-bold">Registration closed</h1>
        <p className="text-muted-foreground mt-2">This event is not accepting new registrations.</p>
      </main>
    );
  }
  const fee = event.registrationFeeCents ?? 0;
  if (fee <= 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-foreground text-3xl font-bold">{event.name}</h1>
        <p className="text-muted-foreground mt-2">
          This event is free. You can RSVP directly on the event page.
        </p>
        <a
          href={`/events/${event.id}`}
          className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-sm px-6 py-2 font-medium text-white"
        >
          Back to event
        </a>
      </main>
    );
  }
  if (!stripeConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-foreground text-3xl font-bold">Payments not configured</h1>
        <p className="text-muted-foreground mt-2">
          Online payment is not available right now. Please contact an admin.
        </p>
      </main>
    );
  }

  const existing = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
    include: { refunds: { where: { status: 'SUCCEEDED' } } },
  });

  if (existing?.status === RegistrationStatus.PAID) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-foreground text-3xl font-bold">You are registered</h1>
        <p className="text-muted-foreground mt-2">
          Your payment of {formatAmount(existing.amountCents, existing.currency)} for {event.name}{' '}
          was received. A receipt was emailed to you.
        </p>
        <a
          href={`/events/${event.id}`}
          className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-sm px-6 py-2 font-medium text-white"
        >
          View event
        </a>
      </main>
    );
  }
  if (
    existing &&
    (existing.status === RegistrationStatus.REFUNDED ||
      existing.status === RegistrationStatus.FORFEITED ||
      existing.status === RegistrationStatus.CANCELLED)
  ) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-foreground text-3xl font-bold">Registration closed</h1>
        <p className="text-muted-foreground mt-2">
          Your previous registration for this event was closed. Contact an admin to re-register.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Register for {event.name}</h1>
        <p className="text-muted-foreground mt-2">
          Amount due: {formatAmount(fee, event.currency)}
        </p>
      </div>

      <PaymentForm
        eventId={event.id}
        eventName={event.name}
        amountCents={fee}
        currency={event.currency}
        publishableKey={getPublishableKey()}
        returnUrl={`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/events/${event.id}/checkout/return`}
      />
    </main>
  );
}
