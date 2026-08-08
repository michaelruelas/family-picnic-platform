import { prisma } from '~/lib/prisma';
import type { Prisma, PrismaClient } from '~/lib/generated/client';

type AdminAuditLogWriter = Pick<PrismaClient, 'adminAuditLog'>;
type AuditLogWriter = Pick<PrismaClient, 'auditLog'>;
type TransactionOrClient = PrismaClient | Prisma.TransactionClient;

export function diff(
  oldVal: unknown,
  newVal: unknown,
): Record<string, { old: unknown; new: unknown }> | null {
  if (oldVal === newVal) return null;
  if (typeof oldVal !== typeof newVal) return { _changed: { old: oldVal, new: newVal } };
  if (typeof oldVal !== 'object' || oldVal === null || newVal === null) {
    return { _changed: { old: oldVal, new: newVal } };
  }
  const result: Record<string, { old: unknown; new: unknown }> = {};
  const oldKeys = new Set(Object.keys(oldVal as Record<string, unknown>));
  const newKeys = new Set(Object.keys(newVal as Record<string, unknown>));
  for (const key of oldKeys) {
    if (!newKeys.has(key))
      result[key] = { old: (oldVal as Record<string, unknown>)[key], new: undefined };
  }
  for (const key of newKeys) {
    const oldItem = (oldVal as Record<string, unknown>)[key];
    const newItem = (newVal as Record<string, unknown>)[key];
    if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      result[key] = { old: oldItem, new: newItem };
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export interface AuditLogEntry {
  userId: string;
  eventId?: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function writeAuditLog(entry: AuditLogEntry, tx?: AdminAuditLogWriter): Promise<void> {
  const client = tx ?? prisma;
  await client.adminAuditLog.create({
    data: {
      userId: entry.userId,
      eventId: entry.eventId,
      action: entry.action,
      oldValue: entry.oldValue ?? undefined,
      newValue: entry.newValue ?? undefined,
    },
  });
}

export interface DomainAuditLogEntry {
  actorId?: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  payload?: unknown;
  occurredAt?: Date;
}

// FPP-50: domain-event audit log writer. Records who performed what
// against which subject (RSVP, PotluckSignup, EventAdmin, Registration,
// Charge, ...). Backed by the append-only `AuditLog` table; entries
// cannot be UPDATEd or DELETEd at the DB level.
export async function writeDomainAuditLog(
  entry: DomainAuditLogEntry,
  tx?: AuditLogWriter,
): Promise<void> {
  const client = (tx ?? prisma) as TransactionOrClient;
  await (client as PrismaClient).auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      payload: entry.payload === undefined ? undefined : (entry.payload as Prisma.InputJsonValue),
      occurredAt: entry.occurredAt,
    },
  });
}
