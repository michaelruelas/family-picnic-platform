import { z } from 'zod';
import { RsvpAttending } from '~/lib/generated/enums';

export const RSVP_ATTENDING_VALUES = [
  RsvpAttending.YES,
  RsvpAttending.NO,
  RsvpAttending.MAYBE,
] as const;

export type RsvpAttendingValue = (typeof RSVP_ATTENDING_VALUES)[number];

export const rsvpAttendingSchema = z.enum(RSVP_ATTENDING_VALUES);

/**
 * A single per-member attendance row sent from the RSVP form.
 * `householdMemberId` is optional so an ad-hoc guest (not in the
 * household member list) can still be added on the fly, but the
 * current UI always sends the id of a real HouseholdMember.
 */
export const rsvpMemberAttendanceInputSchema = z.object({
  householdMemberId: z.string().min(1).nullable().optional(),
  memberName: z.string().trim().min(1, 'Name is required').max(120),
  memberAge: z.number().int().nonnegative().max(120).nullable().optional(),
  attending: rsvpAttendingSchema,
});

export const rsvpMemberAttendanceListSchema = z
  .array(rsvpMemberAttendanceInputSchema)
  .min(1, 'Mark attendance for at least one member');

export type RsvpMemberAttendanceInput = z.infer<typeof rsvpMemberAttendanceInputSchema>;
export type RsvpMemberAttendanceListInput = z.infer<typeof rsvpMemberAttendanceListSchema>;

export function attendingLabel(value: RsvpAttendingValue): string {
  switch (value) {
    case RsvpAttending.YES:
      return 'Going';
    case RsvpAttending.NO:
      return 'Not going';
    case RsvpAttending.MAYBE:
      return 'Maybe';
    default:
      return value;
  }
}
