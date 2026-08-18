declare namespace google {
  namespace maps {
    interface LatLng {
      lat(): number;
      lng(): number;
    }

    interface MapsEventListener {
      remove(): void;
    }

    const event: {
      removeListener(listener: MapsEventListener): void;
    };

    namespace places {
      class PlaceAutocompleteElement extends HTMLElement {
        constructor(opts?: PlaceAutocompleteElementOptions);
        locationBias?: LatLngBoundsLiteral;
        locationRestriction?: LatLngBoundsLiteral;
      }

      interface PlaceAutocompleteElementOptions {
        locationBias?: LatLngBoundsLiteral;
        locationRestriction?: LatLngBoundsLiteral;
      }

      interface LatLngBoundsLiteral {
        west: number;
        north: number;
        east: number;
        south: number;
      }

      interface GmpSelectEvent extends Event {
        placePrediction: PlacePrediction;
      }

      class Place {
        fetchFields(opts: { fields: string[] }): Promise<void>;
        formattedAddress?: string;
        displayName?: string;
        location?: LatLng;
        viewport?: LatLngBoundsLiteral;
        id?: string;
      }

      class PlacePrediction {
        toPlace(): Place;
        text?: { text: string };
      }
    }
  }
}

interface Window {
  google?: typeof google;
}
