'use client';

import { useState, useRef, useEffect } from 'react';
import { loadGoogleMapsScript } from '~/lib/google-maps';

/**
 * FPP-145 follow-up: shape for the Google Places pin data. The host
 * picks an address; the resolved formattedAddress plus lat/lng/placeId
 * flow up. The host's free-form text (customNameValue) is NOT touched
 * by a Google pick — it stays whatever the host typed.
 */
export interface ResolvedLocation {
  location: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}

interface LocationAutocompleteProps {
  /** FPP-145: host-typed display title. The primary location text. */
  customNameValue: string;
  /** Google Places formatted address (auto-filled when host picks a pin). */
  resolvedAddress: string;
  /** Fires when the host types in the top free-form input. */
  onCustomNameChange: (value: string) => void;
  /**
   * Fires when the Google Places picker resolves a pin. The host's
   * custom name is preserved implicitly — only `location`, `lat`,
   * `lng`, `placeId` change.
   */
  onResolvedChange: (resolved: ResolvedLocation) => void;
}

/**
 * FPP-145 follow-up: dual-input location widget.
 *
 * Layout:
 *   - **Top input** (primary): the host types whatever they want
 *     ("Shaver Lake - Camp Edison Tannenager Site"). This string
 *     becomes `event.customLocationName` and is shown to guests.
 *     Typing here does NOT clear the map pin.
 *   - **Bottom input** (Google `PlaceAutocompleteElement`): a "Pin
 *     on map" widget. Picking a suggestion fills `lat`, `lng`,
 *     `placeId` and a `formattedAddress` row — it does NOT touch
 *     the host's typed custom name above.
 *
 * The top input + bottom widget render as one stack. Both pieces
 * of data are saved independently so the public event page can
 * surface the host's custom context alongside the Google resolved
 * address.
 */
export function LocationAutocomplete({
  customNameValue,
  resolvedAddress,
  onCustomNameChange,
  onResolvedChange,
}: LocationAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);

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
      // Only the resolved location + coordinates flow up. The host's
      // typed custom name stays in its own input and its own column.
      onResolvedChange({
        location: place.formattedAddress || '',
        lat: place.location.lat(),
        lng: place.location.lng(),
        placeId: place.id || null,
      });
    });
  }, [scriptLoaded, onResolvedChange]);

  const inputClasses =
    'border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none';

  return (
    <div>
      <label htmlFor="customLocationName" className="text-foreground/85 block text-sm font-medium">
        Location Name
      </label>
      <input
        type="text"
        id="customLocationName"
        name="customLocationName"
        value={customNameValue}
        onChange={(e) => onCustomNameChange(e.target.value)}
        className={inputClasses}
        placeholder="Shaver Lake - Camp Edison Tannenager Site"
      />
      <p className="text-muted-foreground mt-1 text-xs">
        The display title guests see on the event page. Use this for context Google doesn&apos;t
        know — camp names, meeting spots, building numbers, sites.
      </p>

      <label className="text-foreground/85 mt-4 block text-sm font-medium">Pin on map</label>
      <div ref={containerRef} className="mt-1" />
      {resolvedAddress && (
        <p className="text-muted-foreground mt-1 text-xs" data-testid="location-map-resolved">
          📍 Pinned to: <span className="text-foreground font-medium">{resolvedAddress}</span>
        </p>
      )}
      {!resolvedAddress && customNameValue && (
        <p className="text-muted-foreground mt-1 text-xs">
          Pick an address above to pin this on the map. Optional — skip if you only need the display
          title.
        </p>
      )}
      {scriptError && (
        <p className="text-destructive mt-1 text-xs">
          Address autocomplete unavailable. You can still save the event with just the display title
          above.
        </p>
      )}
    </div>
  );
}
