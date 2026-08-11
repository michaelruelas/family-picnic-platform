declare namespace google {
  namespace maps {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
      addListener(eventName: string, handler: () => void): MapsEventListener;
      getPlace(): PlaceResult;
    }

    interface AutocompleteOptions {
      types?: string[];
      fields?: string[];
    }

    interface PlaceResult {
      formatted_address?: string;
      geometry?: {
        location: LatLng;
      };
      place_id?: string;
    }

    class LatLng {
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
      class Autocomplete extends google.maps.Autocomplete {}
    }
  }
}

interface Window {
  google?: typeof google;
}