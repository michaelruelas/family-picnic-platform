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
        <h1 className="text-3xl font-bold text-stone-900">Create New Event</h1>
        <p className="mt-2 text-stone-600">Fill in the details for your family picnic</p>
      </div>

      <EventForm mode="create" />
    </main>
  );
}
