import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import AdminShell from '~/components/admin/AdminShell';
import UserDetailPage from '~/components/admin/UserDetailPage';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return { title: user ? `${user.name} · Users - Admin` : 'User - Admin' };
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  await requireAdminPage();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!user) {
    notFound();
  }

  return (
    <AdminShell title={user.name} description={`User detail and management · ${user.id}`}>
      <UserDetailPage userId={id} />
    </AdminShell>
  );
}
