/**
 * Render an itinerary `time` value (stored as HH:MM or HH:MM:SS, see
 * `ItineraryItem.time` in `prisma/schema.prisma`) in the "10:00 AM"
 * shape the public Itinerary tab and the admin editor both expect.
 *
 * The time is stored as a literal wall-clock string in the event's
 * timezone — see the FPP-45 acceptance criterion "Time displayed in
 * event time zone" — so the host's chosen hours and minutes
 * round-trip without any UTC conversion. This helper only reformats
 * the field for display; it never reinterprets the clock.
 *
 * @param time HH:MM or HH:MM:SS string.
 * @returns "10:00 AM" / "2:30 PM" / `time` (passthrough) when malformed.
 */
export function formatItineraryTime(time: string): string {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  if (Number.isNaN(hour) || minuteStr === undefined) return time;
  const meridian = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr} ${meridian}`;
}
