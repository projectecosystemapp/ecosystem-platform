/**
 * Google Maps Configuration
 * 
 * Provides location services for the marketplace
 * - Provider location mapping
 * - Service area visualization
 * - Customer location search
 * - Distance calculations
 */

export const googleMapsConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  
  // Default map settings
  defaultCenter: {
    lat: 37.7749, // San Francisco
    lng: -122.4194,
  },
  
  defaultZoom: 12,
  
  // Map styles (optional - customize appearance)
  mapStyles: [
    {
      featureType: 'poi.business',
      stylers: [{ visibility: 'off' }],
    },
  ],
  
  // Libraries to load
  libraries: ['places', 'geometry', 'drawing'] as const,
  
  // Map options
  mapOptions: {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: true,
    rotateControl: false,
    fullscreenControl: true,
  },
};

/**
 * Load Google Maps JavaScript API
 */
export function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }
    
    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
      return;
    }
    
    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsConfig.apiKey}&libraries=${googleMapsConfig.libraries.join(',')}`;
    script.async = true;
    script.defer = true;
    
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
    
    document.head.appendChild(script);
  });
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
}> {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${googleMapsConfig.apiKey}`
  );
  
  if (!response.ok) {
    throw new Error('Geocoding failed');
  }
  
  const data = await response.json();
  
  if (data.status !== 'OK' || !data.results[0]) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }
  
  const result = data.results[0];
  
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  };
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in kilometers
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get user's current location
 */
export function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

/**
 * Search for nearby places
 */
export async function searchNearbyPlaces(
  location: { lat: number; lng: number },
  radius: number,
  type?: string
): Promise<any[]> {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}${
      type ? `&type=${type}` : ''
    }&key=${googleMapsConfig.apiKey}`
  );
  
  if (!response.ok) {
    throw new Error('Place search failed');
  }
  
  const data = await response.json();
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Place search failed: ${data.status}`);
  }
  
  return data.results || [];
}

/**
 * Get directions between two points
 */
export async function getDirections(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string,
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'DRIVING'
): Promise<any> {
  const originStr =
    typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
  const destinationStr =
    typeof destination === 'string'
      ? destination
      : `${destination.lat},${destination.lng}`;
  
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      originStr
    )}&destination=${encodeURIComponent(
      destinationStr
    )}&mode=${travelMode}&key=${googleMapsConfig.apiKey}`
  );
  
  if (!response.ok) {
    throw new Error('Directions request failed');
  }
  
  const data = await response.json();
  
  if (data.status !== 'OK') {
    throw new Error(`Directions request failed: ${data.status}`);
  }
  
  return data.routes[0];
}

/**
 * Check if Google Maps is properly configured
 */
export function isGoogleMapsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_MAPS_API_KEY &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );
}