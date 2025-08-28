"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { initializeMapbox, DEFAULT_MAP_CONFIG, handleMapError } from '@/lib/mapbox/client';
import { Coordinates, MapViewState } from '@/lib/mapbox/types';
import { cn } from '@/lib/utils';

// Import Mapbox CSS
import 'mapbox-gl/dist/mapbox-gl.css';

interface BaseMapProps {
  center?: [number, number];
  zoom?: number;
  style?: string;
  className?: string;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onClick?: (coordinates: Coordinates, event: mapboxgl.MapMouseEvent) => void;
  onMove?: (viewState: MapViewState) => void;
  interactive?: boolean;
  showControls?: boolean;
  markers?: Array<{
    id: string;
    coordinates: Coordinates;
    color?: string;
    popup?: string | React.ReactNode;
  }>;
  fitToMarkers?: boolean;
  children?: React.ReactNode;
}

export default function BaseMap({
  center = DEFAULT_MAP_CONFIG.center,
  zoom = DEFAULT_MAP_CONFIG.zoom,
  style = DEFAULT_MAP_CONFIG.style,
  className,
  onMapLoad,
  onClick,
  onMove,
  interactive = true,
  showControls = true,
  markers = [],
  fitToMarkers = false,
  children,
}: BaseMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Memoize callback functions to avoid re-initializing map
  const memoizedOnMapLoad = useCallback((mapInstance: mapboxgl.Map) => {
    onMapLoad?.(mapInstance);
  }, [onMapLoad]);

  const memoizedOnClick = useCallback((coordinates: Coordinates, event: mapboxgl.MapMouseEvent) => {
    onClick?.(coordinates, event);
  }, [onClick]);

  const memoizedOnMove = useCallback((viewState: MapViewState) => {
    onMove?.(viewState);
  }, [onMove]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      initializeMapbox();
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style,
        center,
        zoom,
        interactive,
        attributionControl: showControls,
        logoPosition: showControls ? 'bottom-right' : false,
      });

      // Add navigation controls if enabled
      if (showControls) {
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      }

      // Set up event listeners
      map.current.on('load', () => {
        setIsLoaded(true);
        memoizedOnMapLoad(map.current!);
      });

      if (memoizedOnClick) {
        map.current.on('click', (e) => {
          memoizedOnClick(
            { lat: e.lngLat.lat, lng: e.lngLat.lng },
            e
          );
        });
      }

      if (memoizedOnMove) {
        map.current.on('move', () => {
          if (!map.current) return;
          const center = map.current.getCenter();
          memoizedOnMove({
            latitude: center.lat,
            longitude: center.lng,
            zoom: map.current.getZoom(),
            bearing: map.current.getBearing(),
            pitch: map.current.getPitch(),
          });
        });
      }

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError(handleMapError(e.error));
      });

    } catch (err) {
      console.error('Map initialization error:', err);
      setError(handleMapError(err));
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [style, center, zoom, interactive, showControls, memoizedOnMapLoad, memoizedOnClick, memoizedOnMove]);

  // Update map style
  useEffect(() => {
    if (map.current && isLoaded) {
      map.current.setStyle(style);
    }
  }, [style, isLoaded]);

  // Handle markers
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    const newMarkers = markers.map(markerConfig => {
      const markerEl = document.createElement('div');
      markerEl.className = 'custom-marker';
      markerEl.style.width = '20px';
      markerEl.style.height = '20px';
      markerEl.style.borderRadius = '50%';
      markerEl.style.backgroundColor = markerConfig.color || '#3b82f6';
      markerEl.style.border = '2px solid white';
      markerEl.style.cursor = 'pointer';
      markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([markerConfig.coordinates.lng, markerConfig.coordinates.lat]);

      if (markerConfig.popup) {
        const popup = new mapboxgl.Popup({ offset: 25 });
        
        if (typeof markerConfig.popup === 'string') {
          popup.setHTML(markerConfig.popup);
        } else {
          // For React components, we'd need to render to string or use a different approach
          popup.setHTML('<div>Popup content</div>');
        }
        
        marker.setPopup(popup);
      }

      marker.addTo(map.current!);
      return marker;
    });

    markersRef.current = newMarkers;

    // Fit map to markers if requested
    if (fitToMarkers && markers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach(marker => {
        bounds.extend([marker.coordinates.lng, marker.coordinates.lat]);
      });

      if (markers.length === 1) {
        // Single marker - just center on it
        map.current.flyTo({
          center: [markers[0].coordinates.lng, markers[0].coordinates.lat],
          zoom: 14,
        });
      } else {
        // Multiple markers - fit bounds
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 16,
        });
      }
    }
  }, [markers, isLoaded, fitToMarkers]);

  // Loading state
  if (error) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-gray-100 border border-gray-300 rounded-lg",
        className
      )}>
        <div className="text-center p-8">
          <div className="text-red-500 mb-2">⚠️</div>
          <h3 className="font-semibold text-gray-900 mb-1">Map Error</h3>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '300px' }}
      />
      
      {/* Loading Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Children - overlays, custom controls, etc. */}
      {isLoaded && children}
    </div>
  );
}