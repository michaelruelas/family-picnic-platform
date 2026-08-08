import { z } from 'zod';

const isoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO date');

// FPP-50: filter inputs for the unified admin audit-log view. All fields
// are optional; empty strings from the URLSearchParams layer are coerced
// to undefined so the API treats them as "no filter".
export const auditLogFilterSchema = z
  .object({
    eventId: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    subjectType: z.string().trim().min(1).optional(),
    subjectId: z.string().trim().min(1).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .transform((value) => ({
    eventId: value.eventId || undefined,
    userId: value.userId || undefined,
    action: value.action || undefined,
    subjectType: value.subjectType || undefined,
    subjectId: value.subjectId || undefined,
    from: value.from ? new Date(value.from) : undefined,
    to: value.to ? new Date(value.to) : undefined,
  }));

// Accepts a partial filter (every field optional). Used by callers that
// have no params yet, e.g. the server component that seeds the page.
export const auditLogPartialFilterSchema = auditLogFilterSchema.optional();

export type AuditLogFilter = z.infer<typeof auditLogFilterSchema>;

export type AuditLogSource = 'admin' | 'domain';

// FPP-50: shape returned by the merged admin audit-log API. Either
// source contributes a row; the optional fields are filled in by the
// source that produced the row.
export interface AuditLogEntryView {
  id: string;
  source: AuditLogSource;
  action: string;
  occurredAt: string;
  actor: { id: string; name: string | null; email: string } | null;
  // AdminAuditLog fields
  eventId?: string;
  eventName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  // AuditLog fields
  subjectType?: string;
  subjectId?: string;
  payload?: unknown;
}
