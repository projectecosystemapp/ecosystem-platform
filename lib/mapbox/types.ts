// Mapbox-related TypeScript types

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  address?: string;
  text: string;
  place_type: string[];
  relevance: number;
  properties: {
    accuracy?: string;
  };
  context: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
}

export interface GeocodingResponse {
  type: 'FeatureCollection';
  query: string[];
  features: GeocodingResult[];
  attribution: string;
}

export interface DirectionsResult {
  routes: Array<{
    geometry: {
      coordinates: [number, number][];
      type: 'LineString';
    };
    legs: Array<{
      summary: string;
      weight: number;
      duration: number;
      steps: any[];
      distance: number;
    }>;
    weight_name: string;
    weight: number;
    duration: number;
    distance: number;
  }>;
  waypoints: Array<{
    distance: number;
    name: string;
    location: [number, number];
  }>;
  code: string;
  uuid: string;
}

export interface MapboxFeature {
  id: string | number;
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    title: string;
    description?: string;
    category?: string;
    [key: string]: any;
  };
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapboxStyleConfig {
  light: string;
  dark: string;
  satellite: string;
  street: string;
}

export interface LocationSearchResult {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  category?: string;
  distance?: number;
}

// Cache types
export interface CachedGeocodingResult {
  inputAddress: string;
  formattedAddress: string;
  coordinates: Coordinates;
  accuracy: string;
  confidence: number;
  expiresAt: Date;
  createdAt: Date;
}