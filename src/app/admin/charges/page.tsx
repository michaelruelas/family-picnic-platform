import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { serializeCharge } from '~/lib/serialize';
import ChargesTable, { type AdminChargeRow } from '~/components/admin/ChargesTable';
import AdminShell from '~/components/admin/AdminShell';

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
    <AdminShell
      title="Charges"
      description="Payments, refunds, and forfeits for every event. Card data goes directly to Stripe; we only see payment intent ids and amounts."
    >
      <ChargesTable
        initialCharges={charges.map(serializeCharge) as AdminChargeRow[]}
        events={events.map((e) => ({
          ...e,
          date: e.date.toISOString(),
        }))}
      />
    </AdminShell>
  );
}
