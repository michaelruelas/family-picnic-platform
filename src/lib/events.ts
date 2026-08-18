import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';

/**
 * FPP-148: navbar "current event" lookup. Like getLatestEvent but
 * restricted to non-archived PUBLISHED rows so the navbar never
 * links to a draft, cancelled, or archived event a guest cannot view.
 * Returns only id + name (lean payload for the navbar tRPC call).
 */
export async function getLatestPublishedEvent(): Promise<{ id: string; name: string } | null> {
  const now = new Date();
  const visibleWhere = { status: EventStatus.PUBLISHED, archivedAt: null };

  const upcoming = await prisma.event.findFirst({
    where: { ...visibleWhere, date: { gte: now } },
    orderBy: { date: 'asc' },
    select: { id: true, name: true },
  });
  if (upcoming) return upcoming;

  const past = await prisma.event.findFirst({
    where: visibleWhere,
    orderBy: { date: 'desc' },
    select: { id: true, name: true },
  });

  return past;
}

/**
 * Resolves the latest / most relevant event:
 * 1. The earliest upcoming PUBLISHED event (date >= now, ordered by date asc)
 * 2. If no upcoming PUBLISHED event, the most recent past PUBLISHED event (ordered by date desc)
 * 3. Fallback to any latest event in the database (ordered by date desc)
 */
export async function getLatestEvent() {
  const now = new Date();

  const upcoming = await prisma.event.findFirst({
    where: {
      status: EventStatus.PUBLISHED,
      date: { gte: now },
    },
    orderBy: { date: 'asc' },
  });

  if (upcoming) return upcoming;

  const past = await prisma.event.findFirst({
    where: {
      status: EventStatus.PUBLISHED,
    },
    orderBy: { date: 'desc' },
  });

  if (past) return past;

  return prisma.event.findFirst({
    orderBy: { date: 'desc' },
  });
}

/**
 * Checks whether /events should redirect to the latest event.
 * Defaults to true; can be disabled by setting REDIRECT_EVENTS_TO_LATEST=false.
 */
export function shouldRedirectToLatestEvent(): boolean {
  return process.env.REDIRECT_EVENTS_TO_LATEST !== 'false';
}

/**
 * Builds the vanity RSVP / invitation URL for an event (/events/[id]/rsvp).
 */
export function buildEventInvitationUrl(eventId: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/events/${eventId}/rsvp`;
}
