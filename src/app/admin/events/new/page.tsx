import { requireAdminPage } from '~/lib/admin-auth';
import EventForm from '~/components/event/EventForm';
import AdminShell from '~/components/admin/AdminShell';

export const metadata = { title: 'New Event - Admin' };

export default async function NewEventPage() {
  await requireAdminPage();

  return (
    <AdminShell title="Create New Event" description="Fill in the details for your family picnic">
      <EventForm mode="create" />
    </AdminShell>
  );
}
