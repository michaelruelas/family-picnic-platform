import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import EventForm from '~/components/event/EventForm';

export const metadata = { title: 'New Event - Admin' };

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Create New Event</h1>
        <p className="text-muted-foreground mt-2">Fill in the details for your family picnic</p>
      </div>

      <EventForm mode="create" />
    </main>
  );
}
