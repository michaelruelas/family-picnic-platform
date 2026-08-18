import { requireAdminPage } from '~/lib/admin-auth';
import AdminShell from '~/components/admin/AdminShell';
import HouseholdsTable from '~/components/admin/HouseholdsTable';

export const dynamic = 'force-dynamic';

export default async function AdminHouseholdsPage() {
  await requireAdminPage();

  return (
    <AdminShell
      title="Households"
      description="Create and manage households and their members."
    >
      <HouseholdsTable />
    </AdminShell>
  );
}