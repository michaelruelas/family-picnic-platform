import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminShell from '~/components/admin/AdminShell';
import HouseholdDetailPage from '~/components/admin/HouseholdDetailPage';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const household = await prisma.household.findUnique({ where: { id }, select: { name: true } });
  return { title: household ? `${household.name} · Households - Admin` : 'Household - Admin' };
}

export default async function AdminHouseholdDetailPage({ params }: PageProps) {
  const { id } = await params;
  await requireAdminPage();

  const household = await prisma.household.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!household) {
    notFound();
  }

  return (
    <AdminShell title={household.name} description={`Household detail · ${household.id}`}>
      <HouseholdDetailPage householdId={id} />
    </AdminShell>
  );
}