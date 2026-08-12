import { DEFAULT_CURRENCY } from '~/lib/constants';

export function toEventCreateData(input: {
  name: string;
  date: string;
  location: string;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  description?: string;
  rsvpDeadline?: string | null;
  maxCapacity?: number | null;
  mapImageUrl?: string | null;
  featuredImageUrl?: string | null;
  currency?: string | null;
  registrationFeeCents?: number | null;
  registrationFeeMinAge?: number | null;
}) {
  return {
    name: input.name,
    date: new Date(input.date),
    location: input.location,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    placeId: input.placeId ?? null,
    description: input.description ?? '',
    rsvpDeadline: input.rsvpDeadline ? new Date(input.rsvpDeadline) : null,
    maxCapacity: input.maxCapacity ?? null,
    mapImageUrl: input.mapImageUrl || null,
    // FPP-60: featuredImageUrl is stored as a public S3 URL once
    // the admin upload PUT lands; `||` (not `??`) collapses the
    // empty string form fields send when the host clears the image,
    // matching the PATCH path. `?? null` would leave `""` in the
    // column and break `WHERE featuredImageUrl IS NULL` queries.
    featuredImageUrl: input.featuredImageUrl || null,
    currency: input.currency ?? DEFAULT_CURRENCY,
    registrationFeeCents: input.registrationFeeCents ?? 0,
    registrationFeeMinAge: input.registrationFeeMinAge ?? 0,
  };
}
