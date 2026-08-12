/**
 * Helpers that act on the event-window datetime strings produced by the
 * native `<input type="datetime-local">` and consumed by `EventForm`.
 *
 * The native control round-trips values as `YYYY-MM-DDTHH:MM`. Every
 * significant field (year, month, day, hour, minute) is zero-padded and
 * ordered from most to least significant. A lexicographic comparison on
 * that shape produces the same result as a chronological comparison, so
 * we lean on the property to keep these checks O(n) without parsing
 * `Date` objects on every keystroke.
 *
 * The contract for every helper in this file is the same:
 *   - Both inputs are full `YYYY-MM-DDTHH:MM` strings.
 *   - Empty strings represent "unset" and short-circuit to `false`.
 *   - Do NOT pass `Date.toISOString()` output, Unix timestamps, or any
 *     other format here. The format is dictated by the datetime-local
 *     input and the event schema.
 */

export function isEventWindowAfter(candidate: string, baseline: string): boolean {
  if (!candidate || !baseline) return false;
  return candidate > baseline;
}
