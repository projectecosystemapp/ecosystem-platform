"use client";

import mapboxgl from 'mapbox-gl';
import { MapViewState, Coordinates, MapboxFeature } from './types';

// Initialize Mapbox with the public token
export function initializeMapbox() {
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
  }
  
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  return mapboxgl;
}

// Default map configurations
export const DEFAULT_MAP_CONFIG = {
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-104.9903, 39.7392] as [number, number], // Denver, CO
  zoom: 10,
  attributionControl: true,
  logoPosition: 'bottom-right' as const,
  maxZoom: 18,
  minZoom: 2,
};

export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  satelliteStreets: 'mapbox://styles/mapbox/satellite-streets-v12',
  navigation: 'mapbox://styles/mapbox/navigation-day-v1',
  navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
};

// Get user's current location
export async function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  });
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in miles
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Create a GeoJSON source for multiple points
export function createGeoJSONSource(features: MapboxFeature[]) {
  return {
    type: 'FeatureCollection' as const,
    features,
  };
}

// Helper to create a marker feature
export function createMarkerFeature(
  id: string,
  coordinates: Coordinates,
  properties: Record<string, any>
): MapboxFeature {
  return {
    id,
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [coordinates.lng, coordinates.lat],
    },
    properties,
  };
}

// Map bounds utilities
export function getBoundsForCoordinates(coordinates: Coordinates[]): mapboxgl.LngLatBounds {
  const bounds = new mapboxgl.LngLatBounds();
  
  coordinates.forEach(coord => {
    bounds.extend([coord.lng, coord.lat]);
  });
  
  return bounds;
}

// Fit map to show all coordinates with padding
export function fitMapToCoordinates(
  map: mapboxgl.Map,
  coordinates: Coordinates[],
  padding: number = 50
) {
  if (coordinates.length === 0) return;
  
  if (coordinates.length === 1) {
    // Single point - just center on it
    map.flyTo({
      center: [coordinates[0].lng, coordinates[0].lat],
      zoom: 14,
    });
  } else {
    // Multiple points - fit bounds
    const bounds = getBoundsForCoordinates(coordinates);
    map.fitBounds(bounds, {
      padding,
      maxZoom: 16,
    });
  }
}

// Theme-aware map style selection
export function getMapStyleForTheme(theme: string): string {
  switch (theme) {
    case 'dark':
      return MAP_STYLES.dark;
    case 'light':
    default:
      return MAP_STYLES.streets;
  }
}

// Create custom marker element
export function createCustomMarker(
  color: string = '#3b82f6',
  size: number = 12
): HTMLElement {
  const marker = document.createElement('div');
  marker.style.width = `${size * 2}px`;
  marker.style.height = `${size * 2}px`;
  marker.style.backgroundColor = color;
  marker.style.border = '2px solid white';
  marker.style.borderRadius = '50%';
  marker.style.cursor = 'pointer';
  marker.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  return marker;
}

// Map error handling
export function handleMapError(error: any): string {
  console.error('Map error:', error);
  
  if (error.status === 401) {
    return 'Invalid Mapbox token. Please check your configuration.';
  } else if (error.status === 403) {
    return 'Access denied. Please check your Mapbox token permissions.';
  } else if (error.type === 'NetworkError') {
    return 'Network error. Please check your internet connection.';
  }
  
  return 'An error occurred while loading the map.';
}