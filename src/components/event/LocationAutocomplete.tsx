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
  const inputRef = useRef<HTMLInputElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [geoSelected, setGeoSelected] = useState(hasGeocodedAddress);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setScriptLoaded(true))
      .catch(() => setScriptError(true));
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !inputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      fields: ['formatted_address', 'geometry', 'place_id'],
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place?.geometry?.location) return;
      setGeoSelected(true);
      onChange({
        location: place.formatted_address || inputRef.current?.value || '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id || null,
      });
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [scriptLoaded, onChange]);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGeoSelected(false);
    onChange({
      location: e.target.value,
      lat: null,
      lng: null,
      placeId: null,
    });
  };

  return (
    <div>
      <input
        type="text"
        id="location"
        name="location"
        ref={inputRef}
        value={value}
        onChange={handleManualInput}
        required
        className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
        placeholder="Start typing an address..."
      />
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
