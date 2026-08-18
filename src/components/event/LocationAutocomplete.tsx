'use client';

import { useState, useRef, useEffect } from 'react';
import { loadGoogleMapsScript } from '~/lib/google-maps';

interface LocationAutocompleteProps {
  value: string;
  hasGeocodedAddress: boolean;
  onChange: (data: {
    location: string;
    lat: number | null;
    lng: number | null;
    placeId: string | null;
  }) => void;
}

export function LocationAutocomplete({
  value,
  hasGeocodedAddress,
  onChange,
}: LocationAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [geoSelected, setGeoSelected] = useState(hasGeocodedAddress);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setScriptLoaded(true))
      .catch(() => setScriptError(true));
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || elementRef.current) return;

    const el = new google.maps.places.PlaceAutocompleteElement();
    elementRef.current = el;
    containerRef.current.appendChild(el);

    el.addEventListener('gmp-select', async (event: Event) => {
      const { placePrediction } = event as google.maps.places.GmpSelectEvent;
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ['formattedAddress', 'location', 'id'],
      });
      if (!place.location) return;
      setGeoSelected(true);
      onChange({
        location: place.formattedAddress || '',
        lat: place.location.lat(),
        lng: place.location.lng(),
        placeId: place.id || null,
      });
    });
  }, [scriptLoaded, onChange]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const internalInput = el.querySelector('input') as HTMLInputElement | null;
    if (internalInput && internalInput.value !== value) {
      internalInput.value = value;
    }
  }, [value]);

  // Always render a controlled <input> so manual typing flows back
  // to the parent form. Google Maps' PlaceAutocompleteElement renders
  // its own internal input inside `containerRef` once the script loads
  // — both inputs stay in the DOM so the user can fall back to
  // typing if the suggestions API is unavailable or disabled.
  const inputClasses =
    'border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none';

  return (
    <div>
      <input
        type="text"
        id="location"
        name="location"
        value={value}
        onChange={(e) =>
          onChange({
            location: e.target.value,
            lat: null,
            lng: null,
            placeId: null,
          })
        }
        required
        className={inputClasses}
        placeholder={
          scriptError
            ? 'Enter address manually'
            : scriptLoaded
              ? ''
              : 'Loading address autocomplete…'
        }
        disabled={!scriptLoaded && !scriptError}
      />
      <div ref={containerRef} className="mt-1" />
      {value && !geoSelected && (
        <p className="text-muted-foreground mt-1 text-xs">
          Select an address from the suggestions to enable the map and directions.
        </p>
      )}
      {scriptError && (
        <p className="text-destructive mt-1 text-xs">
          Address autocomplete unavailable. You can type the address manually.
        </p>
      )}
    </div>
  );
}
