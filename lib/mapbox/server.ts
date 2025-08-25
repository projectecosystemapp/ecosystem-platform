import { GeocodingResponse, GeocodingResult, DirectionsResult, Coordinates } from './types';

// Server-side Mapbox utilities using the secret token
// NEVER expose these functions to the client side

const MAPBOX_SECRET_TOKEN = process.env.MAPBOX_SECRET_TOKEN;
const MAPBOX_BASE_URL = 'https://api.mapbox.com';

if (!MAPBOX_SECRET_TOKEN) {
  console.warn('MAPBOX_SECRET_TOKEN is not set. Server-side Mapbox features will not work.');
}

// Rate limiting configuration
const RATE_LIMITS = {
  geocoding: { requests: 100, window: 60000 }, // 100 requests per minute
  directions: { requests: 50, window: 60000 },  // 50 requests per minute
};

// Simple in-memory rate limiter (use Redis in production)
const rateLimiter = new Map<string, { count: number; reset: number }>();

function checkRateLimit(key: string, limit: { requests: number; window: number }): boolean {
  const now = Date.now();
  const windowStart = now - limit.window;
  
  const current = rateLimiter.get(key);
  if (!current || current.reset < windowStart) {
    rateLimiter.set(key, { count: 1, reset: now + limit.window });
    return true;
  }
  
  if (current.count >= limit.requests) {
    return false;
  }
  
  current.count++;
  return true;
}

// Geocode an address to coordinates
export async function geocodeAddress(
  address: string,
  options?: {
    country?: string;
    proximity?: Coordinates;
    bbox?: [number, number, number, number]; // [minX, minY, maxX, maxY]
    types?: string[];
  }
): Promise<GeocodingResult[]> {
  if (!MAPBOX_SECRET_TOKEN) {
    throw new Error('Mapbox secret token not configured');
  }

  // Rate limiting by IP would be better in production
  const rateLimitKey = `geocoding:${address}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMITS.geocoding)) {
    throw new Error('Rate limit exceeded for geocoding');
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_SECRET_TOKEN,
    limit: '5',
    country: options?.country || 'us',
  });

  if (options?.proximity) {
    params.append('proximity', `${options.proximity.lng},${options.proximity.lat}`);
  }

  if (options?.bbox) {
    params.append('bbox', options.bbox.join(','));
  }

  if (options?.types && options.types.length > 0) {
    params.append('types', options.types.join(','));
  }

  const encodedAddress = encodeURIComponent(address);
  const url = `${MAPBOX_BASE_URL}/geocoding/v5/mapbox.places/${encodedAddress}.json?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EcosystemMarketplace/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data: GeocodingResponse = await response.json();
    return data.features;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

// Reverse geocode coordinates to address
export async function reverseGeocode(
  coordinates: Coordinates,
  options?: {
    types?: string[];
  }
): Promise<GeocodingResult[]> {
  if (!MAPBOX_SECRET_TOKEN) {
    throw new Error('Mapbox secret token not configured');
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_SECRET_TOKEN,
    limit: '1',
  });

  if (options?.types && options.types.length > 0) {
    params.append('types', options.types.join(','));
  }

  const url = `${MAPBOX_BASE_URL}/geocoding/v5/mapbox.places/${coordinates.lng},${coordinates.lat}.json?${params}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data: GeocodingResponse = await response.json();
    return data.features;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}

// Get directions between two points
export async function getDirections(
  start: Coordinates,
  end: Coordinates,
  options?: {
    profile?: 'driving' | 'walking' | 'cycling';
    alternatives?: boolean;
    geometries?: 'geojson' | 'polyline' | 'polyline6';
    steps?: boolean;
    continue_straight?: boolean;
    waypoint_snapping?: string[];
  }
): Promise<DirectionsResult> {
  if (!MAPBOX_SECRET_TOKEN) {
    throw new Error('Mapbox secret token not configured');
  }

  const profile = options?.profile || 'driving';
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  
  const params = new URLSearchParams({
    access_token: MAPBOX_SECRET_TOKEN,
    geometries: options?.geometries || 'geojson',
    steps: String(options?.steps ?? false),
    alternatives: String(options?.alternatives ?? false),
  });

  if (options?.continue_straight !== undefined) {
    params.append('continue_straight', String(options.continue_straight));
  }

  const url = `${MAPBOX_BASE_URL}/directions/v5/mapbox/${profile}/${coordinates}?${params}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox Directions API error: ${response.status} ${response.statusText}`);
    }

    const data: DirectionsResult = await response.json();
    return data;
  } catch (error) {
    console.error('Directions error:', error);
    throw error;
  }
}

// Calculate distance matrix between multiple points
export async function getDistanceMatrix(
  origins: Coordinates[],
  destinations: Coordinates[],
  profile: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<{
  durations: number[][]; // in seconds
  distances: number[][]; // in meters
}> {
  if (!MAPBOX_SECRET_TOKEN) {
    throw new Error('Mapbox secret token not configured');
  }

  const originCoords = origins.map(c => `${c.lng},${c.lat}`).join(';');
  const destinationCoords = destinations.map(c => `${c.lng},${c.lat}`).join(';');
  const allCoords = `${originCoords};${destinationCoords}`;
  
  const sources = origins.map((_, i) => i).join(';');
  const destinations_indices = destinations.map((_, i) => origins.length + i).join(';');
  
  const params = new URLSearchParams({
    access_token: MAPBOX_SECRET_TOKEN,
    sources,
    destinations: destinations_indices,
  });

  const url = `${MAPBOX_BASE_URL}/directions-matrix/v1/mapbox/${profile}/${allCoords}?${params}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox Matrix API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      durations: data.durations,
      distances: data.distances,
    };
  } catch (error) {
    console.error('Distance matrix error:', error);
    throw error;
  }
}

// Validate an address and return confidence score
export async function validateAddress(address: string): Promise<{
  isValid: boolean;
  confidence: number;
  formattedAddress?: string;
  coordinates?: Coordinates;
}> {
  try {
    const results = await geocodeAddress(address);
    
    if (results.length === 0) {
      return { isValid: false, confidence: 0 };
    }

    const bestResult = results[0];
    const confidence = bestResult.relevance;
    
    return {
      isValid: confidence > 0.8, // 80% confidence threshold
      confidence,
      formattedAddress: bestResult.place_name,
      coordinates: {
        lat: bestResult.center[1],
        lng: bestResult.center[0],
      },
    };
  } catch (error) {
    console.error('Address validation error:', error);
    return { isValid: false, confidence: 0 };
  }
}

// Find places near a coordinate
export async function findNearbyPlaces(
  center: Coordinates,
  radius: number = 1000, // meters
  types: string[] = ['poi']
): Promise<GeocodingResult[]> {
  if (!MAPBOX_SECRET_TOKEN) {
    throw new Error('Mapbox secret token not configured');
  }

  // Convert radius from meters to degrees (approximate)
  const radiusDegrees = radius / 111000; // 1 degree ≈ 111km
  const bbox: [number, number, number, number] = [
    center.lng - radiusDegrees,
    center.lat - radiusDegrees,
    center.lng + radiusDegrees,
    center.lat + radiusDegrees,
  ];

  const params = new URLSearchParams({
    access_token: MAPBOX_SECRET_TOKEN,
    limit: '10',
    types: types.join(','),
    bbox: bbox.join(','),
  });

  // Search for points of interest near the center
  const url = `${MAPBOX_BASE_URL}/geocoding/v5/mapbox.places/poi.json?${params}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data: GeocodingResponse = await response.json();
    return data.features;
  } catch (error) {
    console.error('Nearby places error:', error);
    throw error;
  }
}