import { prisma } from '~/lib/prisma';
import type { AuditLogEntryView } from '~/lib/schemas/audit';

const MAX_ENTRIES = 100;

export interface ListAuditLogEntriesInput {
  eventId?: string;
  userId?: string;
  action?: string;
  subjectType?: string;
  subjectId?: string;
  from?: Date;
  to?: Date;
}

// FPP-50: returns a unified view of audit-log entries from both
// AdminAuditLog (admin actions) and the new AuditLog table (domain
// events). Results are sorted by occurred time, most recent first, and
// trimmed to MAX_ENTRIES total so the page stays bounded.
export async function listAuditLogEntries(
  filter: ListAuditLogEntriesInput = {},
): Promise<AuditLogEntryView[]> {
  const { eventId, userId, action, subjectType, subjectId, from, to } = filter;

  const [adminRows, domainRows] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: {
        eventId,
        userId,
        action: action ? { contains: action } : undefined,
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ENTRIES,
    }),
    prisma.auditLog.findMany({
      where: {
        action: action ? { contains: action } : undefined,
        actorId: userId,
        subjectType,
        subjectId,
        // FPP-50 review: domain entries store `eventId` inside the
        // payload (the spec is actor / action / subject_type /
        // subject_id / payload). The admin event filter must reach
        // them via Prisma's JSON-path filter so a "show registrations
        // for this event" query returns both admin and domain rows.
        // The composite (subjectType, subjectId) index does not cover
        // this path; a single-column subjectType index would only
        // marginally help. The cost is acceptable for the admin view.
        ...(eventId
          ? {
              payload: { path: ['eventId'], equals: eventId },
            }
          : {}),
        occurredAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { occurredAt: 'desc' },
      take: MAX_ENTRIES,
    }),
  ]);

  const merged: AuditLogEntryView[] = [
    ...adminRows.map((row) => ({
      id: row.id,
      source: 'admin' as const,
      action: row.action,
      // Default to the epoch when the row predates createdAt (legacy
      // entries or pathological mocks) so the merge stays stable.
      occurredAt: (row.createdAt ?? new Date(0)).toISOString(),
      actor: row.user,
      eventId: row.eventId ?? undefined,
      eventName: row.event?.name,
      oldValue: row.oldValue ?? undefined,
      newValue: row.newValue ?? undefined,
    })),
    ...domainRows.map((row) => ({
      id: row.id,
      source: 'domain' as const,
      action: row.action,
      occurredAt: (row.occurredAt ?? new Date(0)).toISOString(),
      actor: row.actor,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      payload: row.payload ?? undefined,
    })),
  ];

  merged.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  return merged.slice(0, MAX_ENTRIES);
}
