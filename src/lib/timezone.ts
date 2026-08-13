/**
 * Resolve the current IANA timezone in a way that is safe to call from
 * both client and server contexts.
 *
 * FPP-62: the date picker must surface the timezone next to the chosen
 * date/time so the admin can see the wall clock they are editing in.
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` works in the
 * browser, but Node returns `'UTC'` for the same call. When the helper
 * runs during SSR we surface `undefined` so the client can re-resolve
 * after hydration and avoid a server/client mismatch warning.
 */

const FALLBACK_TZ = 'UTC';

export function getClientTimezone(): string | undefined {
  if (typeof Intl === 'undefined') return undefined;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : undefined;
  } catch {
    return undefined;
  }
}

export function getServerTimezone(): string {
  if (typeof Intl === 'undefined') return FALLBACK_TZ;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

/**
 * Format the timezone as a human-friendly label, e.g.
 * `'America/Los_Angeles'` -> `'Los Angeles (PDT)'`. The abbreviation is
 * computed for the supplied instant so it tracks DST without the admin
 * having to babysit the field.
 */
export function formatTimezoneLabel(
  timezone: string | undefined,
  instant: Date = new Date(),
): string {
  if (!timezone) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(instant);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    const short = tzPart?.value;
    const city = timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone;
    return short ? `${city} (${short})` : city;
  } catch {
    return timezone;
  }
}
