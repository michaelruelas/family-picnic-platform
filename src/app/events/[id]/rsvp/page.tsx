import { notFound, redirect } from 'next/navigation';
import { prisma } from '~/lib/prisma';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Vanity RSVP / invitation URL for an event (/events/[id]/rsvp).
 * Validates that the event exists, then redirects to the event page
 * with ?rsvpOpen=1 so the RSVP sheet opens directly.
 */
export default async function EventRsvpVanityPage({ params }: Props) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!event) {
    notFound();
  }

  redirect(`/events/${id}?rsvpOpen=1`);
}
