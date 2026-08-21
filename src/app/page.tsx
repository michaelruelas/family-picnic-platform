import { redirect } from 'next/navigation';
import { getLatestEvent, shouldRedirectToLatestEvent } from '~/lib/events';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (shouldRedirectToLatestEvent()) {
    const latestEvent = await getLatestEvent();
    if (latestEvent) {
      redirect(`/events/${latestEvent.id}`);
    }
  }

  redirect('/events');
}
