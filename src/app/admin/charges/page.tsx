import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import ChargesTable from '~/components/admin/ChargesTable';

export const dynamic = 'force-dynamic';

async function getCharges() {
  return prisma.charge.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      registration: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, name: true, date: true } },
        },
      },
      refunds: {
        orderBy: { createdAt: 'desc' },
        include: { refundedBy: { select: { id: true, name: true } } },
      },
    },
  });
}

async function getEvents() {
  return prisma.event.findMany({
    select: { id: true, name: true, date: true, registrationFeeCents: true },
    orderBy: { date: 'desc' },
  });
}

export default async function AdminChargesPage() {
  await requireAdminPage();

  const [charges, events] = await Promise.all([getCharges(), getEvents()]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Admin: Charges</h1>
        <p className="text-muted-foreground mt-2">
          Payments, refunds, and forfeits for every event. Card data goes directly to Stripe; we
          only see payment intent ids and amounts.
        </p>
      </div>

      <ChargesTable
        initialCharges={charges.map((c) => ({
          ...c,
          amountCents: c.amountCents,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          registration: {
            ...c.registration,
            createdAt: c.registration.createdAt.toISOString(),
            updatedAt: c.registration.updatedAt.toISOString(),
            receiptSentAt: c.registration.receiptSentAt?.toISOString() ?? null,
            event: {
              ...c.registration.event,
              date: c.registration.event.date.toISOString(),
            },
          },
          refunds: c.refunds.map((r) => ({
            ...r,
            amountCents: r.amountCents,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          })),
        }))}
        events={events.map((e) => ({
          ...e,
          date: e.date.toISOString(),
        }))}
      />
    </main>
  );
}
