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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
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
