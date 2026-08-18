/**
 * US phone auto-formatter.
 *
 * `formatUsPhone` rewrites a raw input (digits, spaces, parens,
 * dashes, anything the user types or pastes) into the canonical
 * `+1 (xxx) xxx-xxxx` shape. `toE164` reverses the operation so
 * downstream code can persist / API-call the value. The two cursor
 * helpers keep the caret pinned to the same digit between renders
 * so the field never jumps mid-typing.
 *
 * Why a separate module: the RSVP bottom sheet, the admin user
 * editor, and any future phone field should all share one
 * canonical formatter so users see consistent behaviour. Centralising
 * the rules here also lets us unit-test them in isolation.
 */

const MAX_DIGITS = 11;
const COUNTRY_CODE = '1';

/**
 * Format a string as a US phone number: `+1 (xxx) xxx-xxxx`.
 *
 * Behaviour:
 * - Empty input returns an empty string.
 * - All non-digit characters (spaces, parens, dashes, leading `+`)
 *   are stripped before re-formatting.
 * - A leading `1` is treated as the US country code and excluded
 *   from the area code, so `15551234567` and `5551234567` produce
 *   the same display.
 * - The `+1 (xxx) xxx-xxxx` template appears progressively as the
 *   user types: `+1` after the first digit, the closing `)` after
 *   the third, the dash after the sixth, the trailing group as
 *   digits 7–10 arrive.
 * - Input is capped at 11 digits so a paste of a longer string
 *   cannot overflow the layout.
 */
export function formatUsPhone(input: string): string {
  // Strip the "+1" prefix if present. The formatter always re-adds
  // it, so a leading "+1" in the input would otherwise be treated
  // as the start of the area code on re-format (this matters when
  // the caller passes the already-formatted display value back
  // through, e.g. on every keystroke of a controlled input).
  const stripped = input.replace(/^\+1/, '');
  const digits = stripped.replace(/\D/g, '').slice(0, MAX_DIGITS);
  if (digits.length === 0) return '';

  const hasCountry = digits.length === MAX_DIGITS && digits.startsWith(COUNTRY_CODE);
  const rest = hasCountry ? digits.slice(COUNTRY_CODE.length) : digits;
  const area = rest.slice(0, 3);
  const prefix = rest.slice(3, 6);
  const line = rest.slice(6, 10);

  let result = '+1';
  if (area.length > 0) result += ` (${area}`;
  if (area.length === 3) result += ')';
  if (prefix.length > 0) result += ` ${prefix}`;
  if (line.length > 0) result += `-${line}`;
  return result;
}

/**
 * Convert a `formatUsPhone`-shaped display value back to E.164
 * (`+15551234567`). Empty input returns an empty string. When the
 * user has typed only a partial local number (no country code
 * yet), this function prepends the US country code so the value is
 * a valid E.164 string the API can accept.
 */
export function toE164(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith(COUNTRY_CODE)) return '+' + digits;
  return `+${COUNTRY_CODE}${digits}`;
}

/**
 * Count the digits that appear in the first `pos` characters of
 * `s`. Used to remember where the caret was relative to the digit
 * stream before a re-formatting pass.
 */
export function countDigitsBefore(s: string, pos: number): number {
  let count = 0;
  const limit = Math.min(Math.max(pos, 0), s.length);
  for (let i = 0; i < limit; i++) {
    if (/\d/.test(s[i]!)) count += 1;
  }
  return count;
}

/**
 * Return the index in `s` immediately after the `targetDigits`-th
 * digit. Used to restore the caret after a re-formatting pass: if
 * the user had their caret after digit N before, we want it after
 * digit N in the new (formatted) string too.
 */
export function indexAfterDigits(s: string, targetDigits: number): number {
  if (targetDigits <= 0) return 0;
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (/\d/.test(s[i]!)) {
      count += 1;
      if (count === targetDigits) return i + 1;
    }
  }
  return s.length;
}
