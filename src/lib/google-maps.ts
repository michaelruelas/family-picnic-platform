export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
}

let googleMapsLoadPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    googleMapsLoadPromise = Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set'));
    return googleMapsLoadPromise;
  }
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
}

export function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function getEmbedUrl(lat: number, lng: number): string {
  const apiKey = getGoogleMapsApiKey();
  return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}`;
}

/**
 * FPP-152: server-side helper that takes a Google `placeId` and
 * returns the latest `formattedAddress`, `lat`, and `lng` Google
 * has on file for it. Used by the admin re-resolve-location route
 * so a host with a stale or imprecise pin can refresh the
 * coordinates without re-typing the address.
 *
 * Returns `null` when the API key is unset (mirrors the embed/directions
 * helpers) and throws a structured `GooglePlacesError` on non-OK
 * responses so the route can surface a 502 with the upstream status.
 */
export interface ResolvedPlace {
  location: string;
  lat: number;
  lng: number;
}

export class GooglePlacesError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'GooglePlacesError';
  }
}

export async function resolvePlaceFromId(placeId: string): Promise<ResolvedPlace | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('fields', 'formattedAddress,location');

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'formattedAddress,location',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new GooglePlacesError(
      `Google Places Details request failed: ${response.status}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };

  if (!data.formattedAddress || typeof data.location?.latitude !== 'number') {
    throw new GooglePlacesError('Google Places Details response missing fields', 502);
  }

  return {
    location: data.formattedAddress,
    lat: data.location.latitude,
    lng: data.location.longitude ?? Number.NaN,
  };
}
