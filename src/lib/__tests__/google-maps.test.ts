// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GooglePlacesError, resolvePlaceFromId } from '../google-maps';

describe('resolvePlaceFromId (FPP-152)', () => {
  const originalKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-api-key');
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalKey === undefined) {
      vi.unstubAllEnvs();
    } else {
      vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', originalKey);
    }
  });

  it('returns null when the API key is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '');
    const result = await resolvePlaceFromId('place-xyz');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns formattedAddress + lat/lng on a successful response', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          formattedAddress: '1600 Amphitheatre Pkwy, Mountain View, CA',
          location: { latitude: 37.4223871, longitude: -122.0840927 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await resolvePlaceFromId('place-xyz');
    expect(result).toEqual({
      location: '1600 Amphitheatre Pkwy, Mountain View, CA',
      lat: 37.4223871,
      lng: -122.0840927,
    });
  });

  it('sends the X-Goog-Api-Key header and the field mask', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          formattedAddress: 'X',
          location: { latitude: 1, longitude: 2 },
        }),
        { status: 200 },
      ),
    );
    await resolvePlaceFromId('place-xyz');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://places.googleapis.com/v1/places/place-xyz?fields=formattedAddress%2Clocation',
    );
    expect((init as RequestInit).headers).toMatchObject({
      'X-Goog-Api-Key': 'test-api-key',
      'X-Goog-FieldMask': 'formattedAddress,location',
    });
    expect((init as RequestInit).cache).toBe('no-store');
  });

  it('percent-encodes the placeId in the URL', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          formattedAddress: 'X',
          location: { latitude: 1, longitude: 2 },
        }),
        { status: 200 },
      ),
    );
    await resolvePlaceFromId('places/abc 123');
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(
      'https://places.googleapis.com/v1/places/places%2Fabc%20123?fields=formattedAddress%2Clocation',
    );
  });

  it('throws a GooglePlacesError on a non-OK response', async () => {
    fetchSpy.mockResolvedValue(new Response('boom', { status: 503 }));
    await expect(resolvePlaceFromId('place-xyz')).rejects.toBeInstanceOf(GooglePlacesError);
    await expect(resolvePlaceFromId('place-xyz')).rejects.toMatchObject({ status: 503 });
  });

  it('throws a GooglePlacesError when the response is missing formattedAddress or location', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(resolvePlaceFromId('place-xyz')).rejects.toBeInstanceOf(GooglePlacesError);
  });
});
