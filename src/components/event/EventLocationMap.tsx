'use client';

import { getGoogleMapsApiKey, getDirectionsUrl, getEmbedUrl } from '~/lib/google-maps';

interface EventLocationMapProps {
  lat: number;
  lng: number;
  location: string;
}

export function EventLocationMap({ lat, lng, location }: EventLocationMapProps) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    console.warn('EventLocationMap: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
    return null;
  }

  const directionsUrl = getDirectionsUrl(lat, lng);
  const embedUrl = getEmbedUrl(lat, lng);

  return (
    <div className="bg-card shadow-card ring-border/60 overflow-hidden rounded-sm ring-1">
      <div className="aspect-[21/9] w-full">
        <iframe
          title={`Map of ${location}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between px-6 py-4">
        <p className="text-foreground/80 text-sm font-medium">{location}</p>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-terracotta hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Get directions
        </a>
      </div>
    </div>
  );
}
