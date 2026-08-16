import { redirect } from 'next/navigation';
import { prisma } from '~/lib/prisma';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
};

/**
 * Legacy invitation route. Redirects directly to the event vanity RSVP URL.
 */
export default async function LegacyInvitationPage({ params }: Props) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: { eventId: true },
  });

  if (invitation?.eventId) {
    redirect(`/events/${invitation.eventId}/rsvp`);
  }

  redirect('/events');
}
