import type { RSVPStatus } from '~/lib/generated/enums';

export type ExistingRsvp = {
  status: RSVPStatus;
  headcount: number;
  dietaryNotes: string | null;
  modifiedAt: string;
};
