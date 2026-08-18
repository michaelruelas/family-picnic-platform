/**
 * FPP-151: extract the first-name token from a stored member name.
 * The stored value (`RsvpMemberAttendance.memberNameSnapshot`) can
 * be any free-form name. Returning the first whitespace-delimited
 * token keeps the public "Who's coming" surface narrow — guests
 * see "Maria" instead of "Maria Garcia Smith" — while still
 * tolerating extra whitespace, unusual punctuation, or middle
 * names that slipped into the original input.
 *
 * Examples:
 *   extractFirstName("Maria Garcia")      -> "Maria"
 *   extractFirstName("  Maria Garcia ")   -> "Maria"
 *   extractFirstName("Maria")             -> "Maria"
 *   extractFirstName("")                  -> ""
 */
export function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  const firstSpace = trimmed.search(/\s/);
  return firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
}
