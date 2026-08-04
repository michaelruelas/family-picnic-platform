import type { RSVPStatus } from '~/lib/generated/enums';
import type { RsvpAttending } from '~/lib/generated/enums';

export type ExistingRsvpMemberAttendance = {
  id: string;
  householdMemberId: string | null;
  memberName: string;
  memberAge: number | null;
  attending: RsvpAttending;
};

export type ExistingRsvp = {
  id: string;
  status: RSVPStatus;
  headcount: number;
  dietaryNotes: string | null;
  modifiedAt: string;
  memberAttendances: ExistingRsvpMemberAttendance[];
};
