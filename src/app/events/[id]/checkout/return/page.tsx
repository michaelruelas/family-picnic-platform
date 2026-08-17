import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { ChargeStatus, RegistrationStatus } from '~/lib/generated/enums';
import { formatAmount } from '~/lib/currency';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    payment_intent?: string;
    redirect_status?: string;
  }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  return { title: event ? `Registration for ${event.name}` : 'Registration' };
}

export default async function CheckoutReturnPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/events/${id}/checkout`)}`);
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true, currency: true },
  });
  if (!event) redirect('/events');

  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: id, userId: session.user.id } },
    select: {
      status: true,
      amountCents: true,
      currency: true,
      charges: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true },
      },
    },
  });

  // The webhook may not have run yet. The Stripe-side status is the
  // strongest signal we have; combine it with the local state.
  const redirectStatus = sp.redirect_status;
  const latestCharge = registration?.charges[0] ?? null;

  if (registration?.status === RegistrationStatus.PAID) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="bg-card rounded-sm p-8 shadow-sm">
          <h1 className="text-foreground text-3xl font-bold">You are registered</h1>
          <p className="text-muted-foreground mt-2">
            Your payment of {formatAmount(registration.amountCents, registration.currency)} for{' '}
            {event.name} was received. A receipt was emailed to you.
          </p>
          <a
            href={`/events/${event.id}`}
            className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-sm px-6 py-2 font-medium text-white"
          >
            View event
          </a>
        </div>
      </main>
    );
  }

  if (redirectStatus === 'failed' || latestCharge?.status === ChargeStatus.FAILED) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="bg-card rounded-sm p-8 shadow-sm">
          <h1 className="text-foreground text-3xl font-bold">Payment did not complete</h1>
          <p className="text-muted-foreground mt-2">
            Your card was not charged. You can try again, or contact an admin if the problem
            persists.
          </p>
          <a
            href={`/events/${event.id}/checkout`}
            className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-sm px-6 py-2 font-medium text-white"
          >
            Try again
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="bg-card rounded-sm p-8 shadow-sm">
        <h1 className="text-foreground text-3xl font-bold">Processing your payment</h1>
        <p className="text-muted-foreground mt-2">
          Stripe has confirmed your payment. We are updating your registration now.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          You can refresh this page in a moment, or jump back to the event.
        </p>
        <div className="mt-6 flex gap-3">
          <a
            href={`/events/${event.id}/checkout/return`}
            className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
          >
            Refresh status
          </a>
          <a
            href={`/events/${event.id}`}
            className="bg-terracotta hover:bg-terracotta rounded-sm px-4 py-2 text-sm font-medium text-white"
          >
            Back to event
          </a>
        </div>
      </div>
    </main>
  );
}
