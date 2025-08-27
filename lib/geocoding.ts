/**
 * Geocoding utilities for converting addresses to coordinates
 * Uses Google Maps Geocoding API
 */

import { z } from "zod";

// Types
export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

// Validation schema for coordinates
export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Cache for geocoding results (in-memory for now, could use Redis)
const geocodingCache = new Map<string, GeocodingResult>();

/**
 * Get coordinates from an address using Google Maps Geocoding API
 */
export async function getGeocoding(address: string): Promise<GeocodingResult | null> {
  try {
    // Check cache first
    const cacheKey = address.toLowerCase().trim();
    if (geocodingCache.has(cacheKey)) {
      return geocodingCache.get(cacheKey)!;
    }

    // Check if Google Maps API key is configured
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("Google Maps API key not configured, using fallback");
      return getFallbackGeocoding(address);
    }

    // Make API request
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Geocoding API error:", response.status, response.statusText);
      return getFallbackGeocoding(address);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn("No geocoding results found for address:", address);
      return getFallbackGeocoding(address);
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // Extract address components
    let city, state, country, zipCode;
    
    for (const component of result.address_components) {
      const types = component.types;
      
      if (types.includes("locality")) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        state = component.short_name;
      } else if (types.includes("country")) {
        country = component.short_name;
      } else if (types.includes("postal_code")) {
        zipCode = component.long_name;
      }
    }

    const geocodingResult: GeocodingResult = {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      city,
      state,
      country,
      zipCode,
    };

    // Cache the result
    geocodingCache.set(cacheKey, geocodingResult);

    return geocodingResult;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return getFallbackGeocoding(address);
  }
}

/**
 * Reverse geocoding - get address from coordinates
 */
export async function getReverseGeocoding(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    // Validate coordinates
    const coords = coordinatesSchema.parse({ lat, lng });
    
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Reverse geocoding API error:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];

    // Extract address components
    let city, state, country, zipCode;
    
    for (const component of result.address_components) {
      const types = component.types;
      
      if (types.includes("locality")) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        state = component.short_name;
      } else if (types.includes("country")) {
        country = component.short_name;
      } else if (types.includes("postal_code")) {
        zipCode = component.long_name;
      }
    }

    return {
      lat: coords.lat,
      lng: coords.lng,
      formattedAddress: result.formatted_address,
      city,
      state,
      country,
      zipCode,
    };
  } catch (error) {
    console.error("Error in reverse geocoding:", error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Fallback geocoding for major US cities when API is not available
 */
function getFallbackGeocoding(address: string): GeocodingResult | null {
  const addressLower = address.toLowerCase();
  
  // Common US cities with approximate coordinates
  const fallbackCities: Record<string, GeocodingResult> = {
    "san francisco": {
      lat: 37.7749,
      lng: -122.4194,
      formattedAddress: "San Francisco, CA, USA",
      city: "San Francisco",
      state: "CA",
      country: "US",
    },
    "los angeles": {
      lat: 34.0522,
      lng: -118.2437,
      formattedAddress: "Los Angeles, CA, USA",
      city: "Los Angeles",
      state: "CA",
      country: "US",
    },
    "new york": {
      lat: 40.7128,
      lng: -74.0060,
      formattedAddress: "New York, NY, USA",
      city: "New York",
      state: "NY",
      country: "US",
    },
    "chicago": {
      lat: 41.8781,
      lng: -87.6298,
      formattedAddress: "Chicago, IL, USA",
      city: "Chicago",
      state: "IL",
      country: "US",
    },
    "seattle": {
      lat: 47.6062,
      lng: -122.3321,
      formattedAddress: "Seattle, WA, USA",
      city: "Seattle",
      state: "WA",
      country: "US",
    },
    "austin": {
      lat: 30.2672,
      lng: -97.7431,
      formattedAddress: "Austin, TX, USA",
      city: "Austin",
      state: "TX",
      country: "US",
    },
    "miami": {
      lat: 25.7617,
      lng: -80.1918,
      formattedAddress: "Miami, FL, USA",
      city: "Miami",
      state: "FL",
      country: "US",
    },
    "boston": {
      lat: 42.3601,
      lng: -71.0589,
      formattedAddress: "Boston, MA, USA",
      city: "Boston",
      state: "MA",
      country: "US",
    },
    "denver": {
      lat: 39.7392,
      lng: -104.9903,
      formattedAddress: "Denver, CO, USA",
      city: "Denver",
      state: "CO",
      country: "US",
    },
    "portland": {
      lat: 45.5152,
      lng: -122.6784,
      formattedAddress: "Portland, OR, USA",
      city: "Portland",
      state: "OR",
      country: "US",
    },
  };
  
  // Check if address contains any of the fallback cities
  for (const [city, coords] of Object.entries(fallbackCities)) {
    if (addressLower.includes(city)) {
      return coords;
    }
  }
  
  // Default to San Francisco if no match
  console.warn("Using default coordinates for San Francisco");
  return fallbackCities["san francisco"];
}

/**
 * Get bounding box coordinates for a center point and radius
 * Returns { minLat, maxLat, minLng, maxLng }
 */
export function getBoundingBox(
  lat: number,
  lng: number,
  radiusMiles: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const R = 3959; // Earth's radius in miles
  const latDelta = radiusMiles / R * (180 / Math.PI);
  const lngDelta = radiusMiles / (R * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);
  
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Validate if coordinates are within valid ranges
 */
export function isValidCoordinates(lat: any, lng: any): boolean {
  try {
    coordinatesSchema.parse({ lat, lng });
    return true;
  } catch {
    return false;
  }
}