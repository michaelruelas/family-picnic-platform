import { requireAdminPage } from '~/lib/admin-auth';
import AdminShell from '~/components/admin/AdminShell';
import UsersTable from '~/components/admin/UsersTable';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  await requireAdminPage();

  return (
    <AdminShell
      title="Users"
      description="Find and manage registered accounts. Deleting a user soft-deletes their account so the email can be re-registered."
    >
      <UsersTable />
    </AdminShell>
  );
}