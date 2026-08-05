import { z } from 'zod';

/**
 * Maximum number of characters allowed for an attendee display name.
 * Matches the snapshot length used by the RSVP form so a name typed
 * on the form never overflows the persisted snapshot.
 */
export const ATTENDEE_NAME_MAX = 120;

/**
 * Block-list of characters that must never appear in an attendee
 * display name:
 *
 * - 0x00-0x1F and 0x7F: ASCII control codes (NUL, BEL, TAB, LF,
 *   CR, DEL, etc.). Tabs and newlines break single-line name
 *   rendering and the others can be used to spoof UI strings.
 * - 0x2028, 0x2029: Unicode line / paragraph separators. Browsers
 *   treat these like newlines, so they would break the same layout
 *   as ASCII LF.
 * - 0x202F, 0x205F, 0x3000: narrow / medium / ideographic spaces.
 *   They render as whitespace but are not trimmed by `String.trim`,
 *   which lets a single visible space sneak past the required check.
 */
// eslint-disable-next-line no-control-regex -- the whole point of this regex is to deny control characters in user input.
const ATTENDEE_NAME_FORBIDDEN_PATTERN = /[\x00-\x1f\x7f\u2028\u2029\u202f\u205f\u3000]/;

/**
 * Shared Zod schema for any attendee display name used on the RSVP
 * form (adult slots, child slots, ad-hoc guests).
 *
 * Rules enforced (FPP-36 acceptance criteria):
 *
 * - `trim`: leading and trailing whitespace never reach the database.
 *   Empty-after-trim input is rejected with the same message as the
 *   household-member schemas so the error copy stays consistent.
 * - `max`: capped at `ATTENDEE_NAME_MAX` characters. Mirrors the
 *   server-side clamp in `resolveAttendancesForHousehold` so a
 *   malicious client cannot bypass the limit by skipping the form.
 * - `no control characters`: rejects the set above so a malicious
 *   client cannot inject line breaks, invisible characters, or other
 *   control codes.
 *
 * The shared schema keeps every entry point in sync:
 * `rsvpMemberAttendanceInputSchema`, `householdMemberCreateSchema`,
 * and `householdMemberUpdateSchema` all reuse it.
 *
 * Implementation note: the order is `.trim().refine().max()`. We
 * check `min(1)` after `trim` (so empty-after-trim fails) and then
 * apply the max + control-character rules on the trimmed value.
 */
export const attendeeNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(ATTENDEE_NAME_MAX, `Name must be ${ATTENDEE_NAME_MAX} characters or fewer`)
  .refine((value) => !ATTENDEE_NAME_FORBIDDEN_PATTERN.test(value), {
    message: 'Name cannot contain control characters',
  });

export type AttendeeName = z.infer<typeof attendeeNameSchema>;
