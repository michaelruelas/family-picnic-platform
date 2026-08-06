/**
 * Render a date-ish value as a localized string.
 *
 * Centralizes the `new Date(String(value)).toLocaleString()` pattern that was
 * duplicated across DataTable consumers and stories. Tolerates `string`,
 * `number`, and `Date` inputs; passes anything else through `String(value)`
 * first so the spread is forgiving for a `cell: ({ value })` whose type is
 * the default `unknown`.
 *
 * @param value Anything coercible to a `Date`.
 * @param style `'datetime'` (default) or `'date'` — picks the formatter.
 * @returns A user-facing string, or `'-'` when the value can't be parsed.
 */
export function formatDate(value: unknown, style: 'datetime' | 'date' = 'datetime'): string {
  if (value === null || value === undefined) return '-';
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date(String(value));
  }
  if (Number.isNaN(date.getTime())) return '-';
  return style === 'date' ? date.toLocaleDateString() : date.toLocaleString();
}
