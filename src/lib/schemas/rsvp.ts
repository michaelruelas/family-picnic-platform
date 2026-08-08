import { z } from 'zod';
import { RSVPStatus } from '~/lib/generated/enums';
import { rsvpMemberAttendanceListSchema } from './rsvp-member-attendance';

const baseFields = {
  // The headcount is now derived from the per-member attendance list
  // when memberAttendances is present. The router recomputes the
  // headcount server-side, so callers may either send memberAttendances
  // (preferred) or a legacy headcount value. Existing call sites that
  // still send headcount keep working.
  headcount: z.number().int().min(0).optional(),
  memberAttendances: rsvpMemberAttendanceListSchema.optional(),
};

export const rsvpConfirmSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  ...baseFields,
});

export const rsvpDeclineSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  // FPP-88: optional free-form note the guest can attach when
  // declining. Trimmed and bounded so a hostile client cannot ship
  // a megabyte of text. Forwarded to the event owner via a
  // CommunicationLog row when non-empty.
  declineMessage: z.string().trim().max(1000, 'Decline note is too long').optional(),
});

export const rsvpUpdateSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  ...baseFields,
});

export const rsvpAdminOverrideSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  status: z.enum([RSVPStatus.CONFIRMED, RSVPStatus.DECLINED]),
  // FPP-102: optional decline note the admin can attach on the
  // manual-entry modal. Mirrors `rsvpDeclineSchema`'s shape so the
  // same trim + 1000-char cap rules apply on the admin path. The
  // REST route and modal both read this field; the tRPC
  // `adminOverride` proc accepts the value too (it is persisted
  // to the RSVP row and forwarded to the event owners).
  declineMessage: z.string().trim().max(1000, 'Decline note is too long').optional(),
  ...baseFields,
});

export type RsvpConfirmInput = z.infer<typeof rsvpConfirmSchema>;
export type RsvpDeclineInput = z.infer<typeof rsvpDeclineSchema>;
export type RsvpUpdateInput = z.infer<typeof rsvpUpdateSchema>;
export type RsvpAdminOverrideInput = z.infer<typeof rsvpAdminOverrideSchema>;
